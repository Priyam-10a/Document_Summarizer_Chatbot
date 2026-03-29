print("Testing imports...")

from langchain_ollama import OllamaLLM
from langchain_community.vectorstores import Chroma
from sentence_transformers import SentenceTransformer
import chromadb
import pypdf
import docx
import streamlit

print("✅ All imports successful!")

print("\nTesting Llama 3 connection...")
llm = OllamaLLM(model="llama3")
response = llm.invoke("Reply with exactly: Setup complete!")
print(f"Llama 3 says: {response}")

print("\nTesting embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
test_vec = model.encode("Hello world")
print(f"✅ Embedding works! Vector size: {len(test_vec)}")

print("\n🎉 All systems go! Ready to build.")