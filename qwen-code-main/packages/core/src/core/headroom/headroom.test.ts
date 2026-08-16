/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  crushLogOutput,
  crushJsonOutput,
  compressPythonTraceback,
  compressJavaStackTrace,
  applyLiveZoneTrimming,
} from './context-crusher.js';
import { alignSystemPromptForCache, normalizeLineEndings } from './cache-aligner.js';

describe('Headroom Multi-Language Context Crusher', () => {
  it('deduplicates repeating lines in logs', () => {
    const rawLog = [
      'INFO: database connected',
      'INFO: waiting for worker...',
      'INFO: waiting for worker...',
      'INFO: waiting for worker...',
      'INFO: waiting for worker...',
      'INFO: worker ready',
    ].join('\n');

    const crushed = crushLogOutput(rawLog);
    expect(crushed).toContain('INFO: waiting for worker...');
    expect(crushed).toContain('[... repeated 3 more times]');
    expect(crushed).toContain('INFO: worker ready');
  });

  it('compresses Python (Django / FastAPI) Tracebacks by omitting site-packages noise', () => {
    const pythonTrace = `Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/uvicorn/protocols/http/httptools_impl.py", line 426, in run_asgi
    result = await app(self.scope, self.receive, self.send)
  File "/usr/local/lib/python3.11/site-packages/starlette/applications.py", line 122, in __call__
    await self.middleware_stack(scope, receive, send)
  File "/usr/local/lib/python3.11/site-packages/fastapi/routing.py", line 299, in app
    raw_response = await run_endpoint_function(...)
  File "app/api/endpoints/auth.py", line 45, in login_handler
    user = await authenticate_user(db, credentials.username, credentials.password)
  File "app/services/auth_service.py", line 28, in authenticate_user
    raise HTTPException(status_code=401, detail="Invalid token")
fastapi.exceptions.HTTPException: 401: Invalid token`;

    const crushed = crushLogOutput(pythonTrace);
    expect(crushed).toContain('Traceback (most recent call last):');
    expect(crushed).toContain('[... 3 framework frames omitted ...]');
    expect(crushed).toContain('app/api/endpoints/auth.py');
    expect(crushed).toContain('app/services/auth_service.py');
    expect(crushed).toContain('fastapi.exceptions.HTTPException: 401: Invalid token');
  });

  it('compresses Java (Spring Boot) Stack Traces', () => {
    const javaTrace = `Exception in thread "main" java.lang.RuntimeException: DB connection failed
\tat com.mycompany.app.UserService.getUser(UserService.java:42)
\tat org.springframework.web.servlet.FrameworkServlet.processRequest(FrameworkServlet.java:1014)
\tat org.springframework.web.servlet.FrameworkServlet.doGet(FrameworkServlet.java:898)
\tat org.apache.tomcat.util.net.NioEndpoint$SocketProcessor.doRun(NioEndpoint.java:1745)
\tat java.base/java.lang.Thread.run(Thread.java:833)
Caused by: java.sql.SQLException: Connection refused
\tat com.mycompany.app.Database.connect(Database.java:18)`;

    const crushed = crushLogOutput(javaTrace);
    expect(crushed).toContain('java.lang.RuntimeException: DB connection failed');
    expect(crushed).toContain('com.mycompany.app.UserService.getUser');
    expect(crushed).toContain('[... 4 framework frames omitted ...]');
    expect(crushed).toContain('Caused by: java.sql.SQLException: Connection refused');
  });

  it('SmartCrusher limits large JSON arrays', () => {
    const largeArray = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({ id: i, name: `item_${i}` })),
    );

    const crushed = crushJsonOutput(largeArray, 3);
    const parsed = JSON.parse(crushed);
    expect(parsed.length).toBe(4); // 3 items + 1 summary string
    expect(parsed[3]).toContain('17 more items omitted');
  });

  it('protects recent turns under Live Zone', () => {
    const history = [
      {
        role: 'user',
        parts: [{ text: 'Step 1' }],
      },
      {
        role: 'model',
        parts: [
          {
            functionResponse: {
              name: 'shell',
              response: { output: 'poll\npoll\npoll\npoll\npoll\n' },
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [{ text: 'Step 2 (recent)' }],
      },
      {
        role: 'model',
        parts: [
          {
            functionResponse: {
              name: 'shell',
              response: { output: 'poll\npoll\npoll\npoll\npoll\n' },
            },
          },
        ],
      },
    ];

    const trimmed = applyLiveZoneTrimming(history, { liveZoneTurns: 1 });
    // Older step (turn 0/1) should be crushed
    const oldResp = trimmed[1].parts[0].functionResponse.response.output;
    expect(oldResp).toContain('repeated');

    // Recent step (turn 2/3) must be 100% untouched
    const recentResp = trimmed[3].parts[0].functionResponse.response.output;
    expect(recentResp).toBe('poll\npoll\npoll\npoll\npoll\n');
  });
});
