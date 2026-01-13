import os
import google.generativeai as genai

# Paste your key here for the test
os.environ["GEMINI_API_KEY"] = "AIzaSyBnyzg5DIqhGpAH9JfsuivAReU33fNFlHw"
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

print("Checking available models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")