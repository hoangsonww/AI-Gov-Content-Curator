from typing import Dict
from urllib.parse import urlparse
from urllib import robotparser

import aiohttp


class RobotsCache:
    def __init__(self) -> None:
        self._cache: Dict[str, robotparser.RobotFileParser] = {}

    async def allowed(self, session: aiohttp.ClientSession, url: str, user_agent: str, timeout: int) -> bool:
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        if base not in self._cache:
            parser = robotparser.RobotFileParser()
            robots_url = f"{base}/robots.txt"
            try:
                async with session.get(robots_url, timeout=timeout) as resp:
                    if resp.status < 400:
                        content = await resp.text()
                        parser.parse(content.splitlines())
                    else:
                        parser.parse([])
            except Exception:
                parser.parse([])
            self._cache[base] = parser
        return self._cache[base].can_fetch(user_agent, url)
