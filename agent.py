# agent.py
# Agentic AI using Google Gemini + LangGraph ReAct

import os
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

load_dotenv()

# ── LLM Setup ────────────────────────────────────────────────────────────────
print("🔄 Loading Ollama...")
llm = ChatOllama(
    model="gemma4:31b-cloud",
    temperature=0.3,
)
print("✅ Ollama ready!")

memory = MemorySaver()


# ── Tool Factory ──────────────────────────────────────────────────────────────
# Tools are created per-conversation so they capture the conv_id in their closure.

def make_tools(conv_id: str):
    """Build LangChain tools scoped to a specific conversation."""
    from vector_store import search_similar_chunks

    @tool
    def document_search(query: str) -> str:
        """Search the uploaded document for specific information or to answer questions."""
        results = search_similar_chunks(conv_id, query, top_k=4)
        if not results:
            return "No relevant information found in the document."
        context = ""
        for r in results:
            context += f"[Chunk {r['rank']} | Score: {r['score']}]\n{r['chunk']}\n\n"
        return context

    @tool
    def topic_summarizer(topic: str) -> str:
        """Get a concise summary of a specific topic from the document."""
        results = search_similar_chunks(conv_id, topic, top_k=5)
        if not results:
            return "No relevant content found to summarize."
        context = "\n\n".join([r["chunk"] for r in results])
        prompt = (
            f"Based on the following document excerpts, provide a clear summary about: {topic}\n\n"
            f"Document excerpts:\n{context}\n\nSummary:"
        )
        return llm.invoke(prompt).content

    @tool
    def full_document_summary(input: str) -> str:  # noqa: A002
        """Generate a comprehensive summary of the entire uploaded document."""
        results = search_similar_chunks(
            conv_id, "main topics key points overview summary", top_k=8
        )
        if not results:
            return "No document loaded. Please upload a document first."
        context = "\n\n".join([r["chunk"] for r in results])
        prompt = (
            "You are a document summarizer. Read these excerpts and write a comprehensive summary covering:\n"
            "1. Main topic\n2. Key points\n3. Important details\n4. Conclusion\n\n"
            f"Document excerpts:\n{context}\n\nComprehensive Summary:"
        )
        return llm.invoke(prompt).content

    @tool
    def web_search(query: str) -> str:
        """Search the internet for an answer if it cannot be found in the uploaded document. Use this to avoid hallucinating facts."""
        from duckduckgo_search import DDGS
        try:
            results = DDGS().text(query, max_results=3)
            return "\n\n".join([f"Source: {r['href']}\n{r['body']}" for r in results])
        except Exception as e:
            return f"Web search failed: {str(e)}"

    return [document_search, topic_summarizer, full_document_summary, web_search]


# ── Agent Factory ─────────────────────────────────────────────────────────────

def create_agent(conv_id: str):
    """Build a fresh ReAct agent scoped to a conversation."""
    tools = make_tools(conv_id)
    system_prompt = (
        "You are InferaDoc, an advanced Document Analysis AI. The user has already uploaded "
        "their document. You cannot see it directly. YOU MUST ALWAYS proactively use your "
        "tools (document_search, topic_summarizer, full_document_summary) to retrieve "
        "information and answer the user. If the document does not contain the answer, you must NOT hallucinate; "
        "instead, use the web_search tool to find the exact answer on the internet. "
        "If you use the web_search tool, you MUST begin your final response exactly with: '🌍 **Web Search Result:**\\n\\n'. "
        "IMPORTANT FORMATTING RULE: You must write ALL formulas and mathematics using STRICT LaTeX syntax! NEVER use plain unicode math symbols (like ∑ or ∞). "
        "You MUST wrap ALL LaTeX equations inside dollar signs ($) for inline math (e.g. $\\frac{2}{3}$) or double dollar "
        "signs ($$) for block math (e.g. $$\\frac{x}{y}$$). Never ask the user to upload the document."
    )
    agent = create_react_agent(model=llm, tools=tools, prompt=system_prompt, checkpointer=memory)
    return agent


# ── Chat Helper ───────────────────────────────────────────────────────────────

async def chat_stream(agent, conv_id: str, user_message: str):
    """Invoke the agent and yield string chunks asynchronously for streaming."""
    config = {"configurable": {"thread_id": conv_id}}
    
    async for event in agent.astream_events(
        {"messages": [HumanMessage(content=user_message)]},
        config=config,
        version="v2"
    ):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            # Only stream text content meant for the final user, ignoring hidden tool interactions
            if chunk.content and not chunk.tool_calls:
                yield chunk.content
