# document_loader.py
# Reads PDF, Word, and TXT files and splits them into chunks

import os
from pypdf import PdfReader
from docx import Document


def load_pdf(file_path):
    """Extract text from a PDF file"""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text


def load_docx(file_path):
    """Extract text from a Word .docx file"""
    doc = Document(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text


def load_txt(file_path):
    """Extract text from a plain text file"""
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def load_document(file_path):
    """Auto-detect file type and load it"""
    extension = os.path.splitext(file_path)[1].lower()

    if extension == ".pdf":
        print(f"📄 Loading PDF: {file_path}")
        return load_pdf(file_path)
    elif extension == ".docx":
        print(f"📝 Loading Word doc: {file_path}")
        return load_docx(file_path)
    elif extension == ".txt":
        print(f"📃 Loading text file: {file_path}")
        return load_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {extension}")


def split_into_chunks(text, chunk_size=500, overlap=50):
    """
    Split text into overlapping chunks.
    
    chunk_size = how many words per chunk
    overlap    = how many words to repeat between chunks
                 (so context isn't lost at boundaries)
    """
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap  # overlap keeps context

    print(f"✅ Split into {len(chunks)} chunks "
          f"({chunk_size} words each, {overlap} word overlap)")
    return chunks


def load_and_chunk(file_path, chunk_size=500, overlap=50):
    """Main function — load a document and return chunks"""
    text = load_document(file_path)

    if not text.strip():
        raise ValueError("Document appears to be empty!")

    print(f"📊 Total words extracted: {len(text.split())}")
    chunks = split_into_chunks(text, chunk_size, overlap)
    return chunks


# ── Quick test ──────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        # No file given — create a dummy test
        print("No file provided — running with dummy text...\n")
        dummy = """Artificial intelligence is transforming the world.
        Machine learning is a subset of AI. Deep learning uses neural networks.
        Natural language processing helps computers understand human language.
        RAG stands for Retrieval Augmented Generation. It combines search with LLMs.
        Vector databases store embeddings for fast similarity search.
        LangChain is a framework for building AI applications.
        Ollama lets you run large language models locally on your computer.""" * 10

        chunks = split_into_chunks(dummy, chunk_size=50, overlap=10)
        print(f"\nFirst chunk preview:\n{'-'*40}\n{chunks[0]}\n{'-'*40}")
        print(f"\nSecond chunk preview:\n{'-'*40}\n{chunks[1]}\n{'-'*40}")
    else:
        # Real file given
        chunks = load_and_chunk(sys.argv[1])
        print(f"\nFirst chunk preview:\n{'-'*40}\n{chunks[0]}\n{'-'*40}")