import sys
sys.stdout.reconfigure(encoding='utf-8')
import asyncio

agent = create_agent('test_id')

async def run():
    async for chunk in chat_stream(agent, 'test_id', 'What is the Riemann Hypothesis?'):
        print(chunk, end='', flush=True)

asyncio.run(run())
