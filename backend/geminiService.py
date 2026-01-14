import os
import json
import re
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from typing import Dict, Any, List

# setup flask
app = Flask(__name__)
# note to all: i just allowed all origins cus frontend was getting blocked. 
# dont touch this unless u want cors errors again lol
CORS(app, resources={r"/*": {"origins": "*"}})

# config stuff
# NTA (Note To All): this is the key currently as of  ------------------------------------------------------------------------- 11/1/2026
GOOGLE_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyCVA9LarBnRuk0JKuRCpC7GV2E7Z4lccZk") 

# using the faster flash model
# i picked flash cus its way faster than pro. change if u want smarter results but slower response
API_MODEL_NAME = 'gemini-flash-latest'

try:
    if not GOOGLE_API_KEY or "YOUR_KEY" in GOOGLE_API_KEY:
        print("⚠️ Warning: API Key might be invalid.")
    
    genai.configure(api_key=GOOGLE_API_KEY)
    gemini_client = genai.GenerativeModel(API_MODEL_NAME)
    print(f"✅ Gemini API Client configured successfully ({API_MODEL_NAME}).")
except Exception as e:
    # if this fails, check ur internet or the key might be dead
    print(f"❌ CONFIGURATION ERROR: {e}")
    gemini_client = None

# class to load the dictionary
class SignDictionary:
    def __init__(self, json_file='signs.json'):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.json_file_path = os.path.join(self.script_dir, json_file)
        self.signs = self._load_signs()
        self.keys_list = list(self.signs.keys()) # cache this so we don't rebuild it every time

    def _load_signs(self) -> Dict[str, Any]:
        if not os.path.exists(self.json_file_path):
            print(f"❌ ERROR: {self.json_file_path} not found!")
            return {}
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                signs_dict = {}
                # logic: iterate thru json list, map keywords to images/videos
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
                            # save the exact keyword
                            signs_dict[keyword] = media_info
                            
                            # quick fix: handle "terima kasih" vs "terimakasih"
                            # i made it like this cus users keep typing it wrong
                            if ' ' in keyword:
                                signs_dict[keyword.replace(' ', '')] = media_info
                                
                                # add individual words too just in case 
                                for word in keyword.split():
                                    w_clean = word.strip()
                                    if w_clean not in signs_dict:
                                        signs_dict[w_clean] = media_info

            print(f"📚 SUCCESS: Loaded {len(signs_dict)} signs.")
            return signs_dict
        except Exception as e:
            # idk why json fails sometimes, usually formatting error --------------------------------------------------------- HERE
            print(f"❌ FAILED TO READ JSON: {e}")
            return {}

    def lookup(self, word: str):
        return self.signs.get(word.lower().strip())

# gemini + matching logic
class SignMatcher:
    def __init__(self, client, dictionary):
        self.client = client # this the gemini object
        self.dictionary = dictionary

    def get_gemini_sequence(self, raw_text: str) -> List[str]:
        """
        Asks Gemini to break the text into a list of known dictionary keys.
        """
        if not self.client:
            print("⚠️ Gemini client missing, falling back to simple split.")
            return raw_text.split()

        # give ai the list of words we actually know
        # limiting to 1000 keys cus prompt limit is very much REAL
        available_keys = ", ".join(self.dictionary.keys_list[:1000])
        
        # [DEBUGGER HERE]
        # NTA: please read this prompt carefully. 3 HARI AKU TUNE PROMPT INI.
        # basically telling it to map user slang -> our exact json keys
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
            # [DEBUGGER breakpoint] ------------------------------------------------------------------------------------------ IMPORTANTE
            # step over this line -> code freezes -> waits for google -> comes back
            # temp is 0.1 cus we want it strictly factual, no creativity 
            response = self.client.generate_content(prompt, generation_config={"temperature": 0.1})
            
            # [DEBUGGER: CHECK RESULT]
            # look at 'response.text' right now.
            # ideally it's something clean like '["saya", "makan"]'
            
            # cleanup the mess (remove markdown ```json if ai adds it, typical ai behavior)
            cleaned_text = response.text.strip().replace("```json", "").replace("```", "") 
            
            # turn string "['a','b']" into actual list ['a', 'b']
            sequence = json.loads(cleaned_text)
            
            print(f"🤖 Gemini Sequence: {raw_text} -> {sequence}")
            return sequence
            
        except Exception as e:
            # if ai fails or internet dies, just split by space. old school way but works.
            print(f"❌ Gemini parsing failed: {e}")
            return raw_text.lower().split()

    def match_signs(self, raw_text: str):
        print(f"🎯 Processing via Gemini: '{raw_text}'")
        
        # 1. get ai to break it down
        word_sequence = self.get_gemini_sequence(raw_text)
        
        results = []
        
        # 2. find corresponding images/videos for each word
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
                # missing word handling. frontend handles the empty box display
                print(f"   ❌ Missing: '{clean_word}'")
                results.append({
                    "word": clean_word,
                    "media": None, 
                    "found": False
                })
        
        return {
            "results": results,
            "original_text": raw_text
        }

# init everything
dictionary_instance = SignDictionary()
matcher = SignMatcher(gemini_client, dictionary_instance)

# routes
@app.route('/health', methods=['GET'])
def health():
    # just a standard health check to see if server is alive
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
        
        # run the magic
        result = matcher.match_signs(text)
        
        return jsonify(result)
        
    except Exception as e:
        # catch-all for random crashes
        print(f"❌ Error in translate endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static_files(filename):
    # serving images from local static folder
    return send_from_directory('static', filename)

@app.route('/')
def index():
    return f"BIM Buddy AI Backend Running. Loaded {len(dictionary_instance.signs)} signs."

# start server
if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 BIM SUPER-SMART BACKEND STARTING")
    print(f"🤖 AI Model: {API_MODEL_NAME}")
    print("="*50 + "\n")
    # debug=True is on so we can see errors in terminal, turn off for prod
    app.run(debug=True, port=5000, host='0.0.0.0')