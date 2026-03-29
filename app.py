# app.py
# Streamlit Chat UI for the Document Summarizer Agent

import streamlit as st
import os
import tempfile

# ── Page Config ───────────────────────────────────────────────
st.set_page_config(
    page_title="InferaDoc — AI Document Assistant",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ── Custom CSS ────────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

    html, body, [class*="css"] { font-family: 'DM Sans', sans-serif; }

    .stApp { background-color: #0d0d0f; color: #e8e4dc; }

    [data-testid="stSidebar"] {
        background-color: #111114;
        border-right: 1px solid #222228;
    }

    .app-title {
        font-family: 'Syne', sans-serif;
        font-weight: 800;
        font-size: 2rem;
        color: #f0ebe0;
        letter-spacing: -0.03em;
        margin-bottom: 0.1rem;
    }

    .app-subtitle {
        font-size: 0.8rem;
        color: #666;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 1.5rem;
    }

    .chat-msg-user {
        background: #1a1a20;
        border: 1px solid #2a2a35;
        border-radius: 16px 16px 4px 16px;
        padding: 14px 18px;
        margin: 8px 0;
        margin-left: 15%;
        color: #e8e4dc;
        font-size: 0.92rem;
        line-height: 1.6;
    }

    .chat-msg-agent {
        background: #111118;
        border: 1px solid #222230;
        border-left: 3px solid #7c6af7;
        border-radius: 4px 16px 16px 16px;
        padding: 14px 18px;
        margin: 8px 0;
        margin-right: 10%;
        color: #d4cfca;
        font-size: 0.92rem;
        line-height: 1.7;
    }

    .msg-label {
        font-family: 'Syne', sans-serif;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 6px;
    }

    .label-user { color: #888; }
    .label-agent { color: #7c6af7; }

    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .status-ready {
        background: #0d2b1a;
        color: #4ade80;
        border: 1px solid #166534;
    }

    .status-empty {
        background: #1a1000;
        color: #facc15;
        border: 1px solid #713f12;
    }

    .section-header {
        font-family: 'Syne', sans-serif;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #555;
        margin: 1.2rem 0 0.6rem;
        padding-bottom: 6px;
        border-bottom: 1px solid #1e1e24;
    }

    .stButton > button {
        background: #7c6af7;
        color: white;
        border: none;
        border-radius: 8px;
        font-family: 'Syne', sans-serif;
        font-weight: 600;
        font-size: 0.82rem;
        letter-spacing: 0.05em;
        padding: 0.5rem 1rem;
        transition: all 0.2s ease;
        width: 100%;
    }

    .stButton > button:hover {
        background: #6a57e8;
        transform: translateY(-1px);
    }

    .doc-card {
        background: #13131a;
        border: 1px solid #222230;
        border-radius: 10px;
        padding: 12px 14px;
        margin: 8px 0;
    }

    .doc-name {
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: 0.85rem;
        color: #c8c0f0;
        margin-bottom: 4px;
    }

    .doc-meta { font-size: 0.75rem; color: #555; }

    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)


# ── Lazy Load Models (cached, runs only once) ─────────────────
@st.cache_resource(show_spinner="🔄 Loading AI models... (first time only)")
def load_models():
    from langchain_ollama import ChatOllama
    from sentence_transformers import SentenceTransformer
    llm = ChatOllama(model="llama3.1", temperature=0.3)
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return llm, embedder


@st.cache_resource(show_spinner=False)
def build_agent(_llm):
    from langchain_core.tools import tool
    from langgraph.prebuilt import create_react_agent
    from langgraph.checkpoint.memory import MemorySaver
    from vector_store import search_similar_chunks

    @tool
    def document_search(query: str) -> str:
        """Search the document for specific information or to answer questions."""
        results = search_similar_chunks(query, top_k=3)
        if not results:
            return "No relevant information found in the document."
        context = ""
        for r in results:
            context += f"[Chunk {r['rank']} | Score: {r['score']}]\n{r['chunk']}\n\n"
        return context

    @tool
    def topic_summarizer(topic: str) -> str:
        """Get a summary of a specific topic from the document."""
        results = search_similar_chunks(topic, top_k=5)
        if not results:
            return "No relevant content found to summarize."
        context = "\n\n".join([r["chunk"] for r in results])
        prompt = f"Summarize this topic: {topic}\n\nDocument excerpts:\n{context}\n\nSummary:"
        return _llm.invoke(prompt)

    @tool
    def full_document_summary(input: str) -> str:
        """Generate a complete summary of the entire document."""
        results = search_similar_chunks("main topics key points overview summary", top_k=8)
        if not results:
            return "No document loaded. Please upload a document first."
        context = "\n\n".join([r["chunk"] for r in results])
        prompt = f"""Summarize this document covering:
1. Main topic
2. Key points
3. Important details
4. Conclusion

Document excerpts:
{context}

Comprehensive Summary:"""
        return _llm.invoke(prompt)

    tools  = [document_search, topic_summarizer, full_document_summary]
    memory = MemorySaver()
    return create_react_agent(model=_llm, tools=tools, checkpointer=memory)


# ── Session State Init ────────────────────────────────────────
if "messages"   not in st.session_state: st.session_state.messages   = []
if "doc_loaded" not in st.session_state: st.session_state.doc_loaded = False
if "doc_info"   not in st.session_state: st.session_state.doc_info   = {}
if "agent"      not in st.session_state: st.session_state.agent      = None


# ── Boot: load models (spinner shows, page renders after) ─────
llm, embedder = load_models()


# ── Chat helper ───────────────────────────────────────────────
def run_chat(agent, user_message):
    from langchain_core.messages import HumanMessage
    config = {"configurable": {"thread_id": "streamlit-session-1"}}
    result = agent.invoke(
        {"messages": [HumanMessage(content=user_message)]},
        config=config
    )
    return result["messages"][-1].content


# ── Sidebar ───────────────────────────────────────────────────
with st.sidebar:
    st.markdown('<div class="app-title">🧠 InferaDoc</div>', unsafe_allow_html=True)
    st.markdown('<div class="app-subtitle">AI Document Assistant</div>', unsafe_allow_html=True)

    if st.session_state.doc_loaded:
        st.markdown('<span class="status-badge status-ready">● Document Ready</span>', unsafe_allow_html=True)
    else:
        st.markdown('<span class="status-badge status-empty">○ No Document Loaded</span>', unsafe_allow_html=True)

    st.markdown('<div class="section-header">Upload Document</div>', unsafe_allow_html=True)

    uploaded_file = st.file_uploader(
        "Drop your file here",
        type=["pdf", "docx", "txt"],
        label_visibility="collapsed"
    )

    if uploaded_file and st.button("⚡ Process Document"):
        with st.spinner("Processing document..."):
            try:
                from vector_store import embed_and_store, clear_collection

                suffix = os.path.splitext(uploaded_file.name)[1]
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(uploaded_file.read())
                    tmp_path = tmp.name

                clear_collection()
                embed_and_store(tmp_path, chunk_size=500, overlap=50)
                os.unlink(tmp_path)

                # Rebuild agent fresh for new document
                build_agent.clear()
                st.session_state.agent      = build_agent(llm)
                st.session_state.doc_loaded = True
                st.session_state.doc_info   = {
                    "name": uploaded_file.name,
                    "size": f"{uploaded_file.size / 1024:.1f} KB",
                    "type": suffix.upper().replace(".", "")
                }
                st.session_state.messages = []
                st.success("✅ Document ready!")
                st.rerun()

            except Exception as e:
                st.error(f"Error: {str(e)}")

    if st.session_state.doc_loaded:
        info = st.session_state.doc_info
        st.markdown(f"""
        <div class="doc-card">
            <div class="doc-name">📄 {info.get('name', 'Document')}</div>
            <div class="doc-meta">{info.get('type', '')} &middot; {info.get('size', '')}</div>
        </div>
        """, unsafe_allow_html=True)

    if st.session_state.doc_loaded:
        st.markdown('<div class="section-header">Quick Actions</div>', unsafe_allow_html=True)
        for emoji, prompt in [
            ("📋", "Give me a full summary"),
            ("🔑", "What are the key points?"),
            ("❓", "What is the main topic?"),
            ("📌", "List the important details"),
        ]:
            if st.button(f"{emoji} {prompt}", key=f"quick_{prompt}"):
                st.session_state.messages.append({"role": "user", "content": prompt})
                with st.spinner("Thinking..."):
                    try:
                        response = run_chat(st.session_state.agent, prompt)
                        st.session_state.messages.append({"role": "agent", "content": response})
                    except Exception as e:
                        st.session_state.messages.append({"role": "agent", "content": f"⚠️ Error: {str(e)}"})
                st.rerun()

    if st.session_state.messages:
        st.markdown('<div class="section-header">Session</div>', unsafe_allow_html=True)
        if st.button("🗑️ Clear Chat"):
            st.session_state.messages = []
            build_agent.clear()
            st.session_state.agent = build_agent(llm)
            st.rerun()


# ── Main Area ─────────────────────────────────────────────────
if not st.session_state.doc_loaded:
    st.markdown("""
    <div style="text-align:center; padding: 6rem 2rem; color: #444;">
        <div style="font-size: 3.5rem; margin-bottom: 1rem;">🧠</div>
        <div style="font-family: 'Syne', sans-serif; font-size: 1.4rem;
                    font-weight: 700; color: #666; margin-bottom: 0.5rem;">
            Upload a document to begin
        </div>
        <div style="font-size: 0.85rem; color: #444; max-width: 360px;
                    margin: 0 auto; line-height: 1.7;">
            Supports PDF, Word (.docx), and plain text.<br>
            Ask questions, get summaries, explore your content.
        </div>
    </div>
    """, unsafe_allow_html=True)

else:
    if not st.session_state.messages:
        doc_name = st.session_state.doc_info.get("name", "your document")
        st.markdown(f"""
        <div style="text-align:center; padding: 2rem 1rem; color: #555;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
            <div style="font-family: 'Syne', sans-serif; font-size: 0.95rem;
                        font-weight: 700; color: #666;">
                <b style="color:#c8c0f0">{doc_name}</b> is ready
            </div>
            <div style="font-size: 0.8rem; color: #444; margin-top: 0.4rem;">
                Ask anything about the document
            </div>
        </div>
        """, unsafe_allow_html=True)

    for msg in st.session_state.messages:
        if msg["role"] == "user":
            st.markdown(f"""
            <div class="chat-msg-user">
                <div class="msg-label label-user">You</div>
                {msg['content']}
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="chat-msg-agent">
                <div class="msg-label label-agent">⬡ InferaDoc</div>
                {msg['content']}
            </div>
            """, unsafe_allow_html=True)

    if prompt := st.chat_input("Ask something about the document..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.spinner("Thinking..."):
            try:
                response = run_chat(st.session_state.agent, prompt)
                st.session_state.messages.append({"role": "agent", "content": response})
            except Exception as e:
                st.session_state.messages.append({
                    "role": "agent",
                    "content": f"⚠️ Something went wrong: {str(e)}"
                })
        st.rerun()