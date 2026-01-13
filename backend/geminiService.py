import os
import json
import re
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from typing import Dict, Any, List

# --- FLASK APP INITIALIZATION ---
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- CONFIGURATION ---
# ⚠️ REPLACE WITH YOUR ACTUAL KEY
GOOGLE_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyBnyzg5DIqhGpAH9JfsuivAReU33fNFlHw")

# We use the smart Flash model
API_MODEL_NAME = 'gemini-flash-latest'

try:
    if not GOOGLE_API_KEY or "YOUR_KEY" in GOOGLE_API_KEY:
        print("⚠️ Warning: API Key might be invalid.")
    
    genai.configure(api_key=GOOGLE_API_KEY)
    gemini_client = genai.GenerativeModel(API_MODEL_NAME)
    print(f"✅ Gemini API Client configured successfully ({API_MODEL_NAME}).")
except Exception as e:
    print(f"❌ CONFIGURATION ERROR: {e}")
    gemini_client = None

# --- SIGN DICTIONARY CLASS ---
class SignDictionary:
    def __init__(self, json_file='signs.json'):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.json_file_path = os.path.join(self.script_dir, json_file)
        self.signs = self._load_signs()
        self.keys_list = list(self.signs.keys()) # Cache keys for AI prompt

    def _load_signs(self) -> Dict[str, Any]:
        if not os.path.exists(self.json_file_path):
            print(f"❌ ERROR: {self.json_file_path} not found!")
            return {}
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                signs_dict = {}
                if isinstance(data, list):
                    for item in data:
                        keyword = item.get('keyword', '').lower()
                        images = item.get('images', [])
                        videos = item.get('videos', [])
                        translation = item.get('translation_ms', '')
                        
                        if keyword:
                            media_info = {
                                "image": images[0] if images else None,
                                "video": videos[0] if videos else None,
                                "translation": translation
                            }
                            # Store exact keyword
                            signs_dict[keyword] = media_info
                            
                            # Clean "terima kasih" -> "terimakasih" mapping
                            if ' ' in keyword:
                                signs_dict[keyword.replace(' ', '')] = media_info
                                
                                # Store individual words too
                                for word in keyword.split():
                                    w_clean = word.strip()
                                    if w_clean not in signs_dict:
                                        signs_dict[w_clean] = media_info

            print(f"📚 SUCCESS: Loaded {len(signs_dict)} signs.")
            return signs_dict
        except Exception as e:
            print(f"❌ FAILED TO READ JSON: {e}")
            return {}

    def lookup(self, word: str):
        return self.signs.get(word.lower().strip())

# --- SIGN MATCHER (THE AI BRAIN) ---
class SignMatcher:
    def __init__(self, client, dictionary):
        self.client = client
        self.dictionary = dictionary

    def get_gemini_sequence(self, raw_text: str) -> List[str]:
        """
        Asks Gemini to break the text into a list of known dictionary keys.
        """
        if not self.client:
            print("⚠️ Gemini client missing, falling back to simple split.")
            return raw_text.split()

        # Provide context of available signs (limited to avoid token overflow if massive)
        available_keys = ", ".join(self.dictionary.keys_list[:1000])
        
        prompt = f"""
        You are a Malaysian Sign Language (BIM) Interpreter System.
        
        --- TASK ---
        Convert the User Input into a JSON List of keywords that exist in my Dictionary.
        1. Fix any typos or Malaysian slang (e.g. "aq" -> "aku", "x" -> "tak").
        2. Break sentences into individual words/concepts.
        3. Match each concept to the closest key in the "Available Keys" list.
        4. If a word has no match, keep the word as is.
        
        --- DATA ---
        User Input: "{raw_text}"
        Available Dictionary Keys: [{available_keys}, ...]

        --- OUTPUT FORMAT ---
        Return ONLY a raw JSON array of strings. No markdown, no explanation.
        Example: ["saya", "mahu", "makan"]
        """

        try:
            response = self.client.generate_content(prompt, generation_config={"temperature": 0.1})
            cleaned_text = response.text.strip().replace("```json", "").replace("```", "")
            
            # Parse the list
            sequence = json.loads(cleaned_text)
            print(f"🤖 Gemini Sequence: {raw_text} -> {sequence}")
            return sequence
            
        except Exception as e:
            print(f"❌ Gemini parsing failed: {e}")
            # Fallback to simple split if AI fails
            return raw_text.lower().split()

    def match_signs(self, raw_text: str):
        print(f"🎯 Processing via Gemini: '{raw_text}'")
        
        # 1. Ask Gemini to interpret the sentence
        word_sequence = self.get_gemini_sequence(raw_text)
        
        results = []
        
        # 2. Map the sequence to actual media
        for word in word_sequence:
            clean_word = word.lower().strip()
            media = self.dictionary.lookup(clean_word)
            
            if media:
                print(f"   ✅ Found: '{clean_word}'")
                results.append({
                    "word": clean_word,
                    "media": media,
                    "found": True
                })
            else:
                print(f"   ❌ Missing: '{clean_word}'")
                results.append({
                    "word": clean_word,
                    "media": None, # Frontend handles empty media
                    "found": False
                })
        
        return {
            "results": results,
            "original_text": raw_text
        }

# --- INITIALIZATION ---
dictionary_instance = SignDictionary()
matcher = SignMatcher(gemini_client, dictionary_instance)

# --- ROUTES ---
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "dictionary_size": len(dictionary_instance.signs),
        "ai_model": API_MODEL_NAME
    })

@app.route('/translate', methods=['POST'])
def translate_endpoint():
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({"error": "Text cannot be empty"}), 400
        
        # Pass to Gemini-powered matcher
        result = matcher.match_signs(text)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error in translate endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static_files(filename):
    return send_from_directory('static', filename)

@app.route('/')
def index():
    return f"BIM Buddy AI Backend Running. Loaded {len(dictionary_instance.signs)} signs."

# --- MAIN ---
if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 BIM SUPER-SMART BACKEND STARTING")
    print(f"🤖 AI Model: {API_MODEL_NAME}")
    print("="*50 + "\n")
    app.run(debug=True, port=5000, host='0.0.0.0')