# test_setup.py — run this to confirm all installs are working

print("Testing imports...")

from langchain_ollama import OllamaLLM
from langchain_community.vectorstores import Chroma
from sentence_transformers import SentenceTransformer
import chromadb
import pypdf
import docx
import streamlit

print("✅ All imports successful!")

# Test Ollama connection
print("\nTesting Ollama + Llama 3 connection...")
llm = OllamaLLM(model="llama3")
response = llm.invoke("Reply with exactly: Setup complete!")
print(f"Llama 3 says: {response}")

# Test embedding model
print("\nTesting embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")  # small, fast, free
test_vec = model.encode("Hello world")
print(f"✅ Embedding model works! Vector size: {len(test_vec)}")

print("\n🎉 All systems go! Ready to build.")