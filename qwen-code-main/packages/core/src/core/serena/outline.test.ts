/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { generateCodeOutline, extractOutline } from './outline.js';

describe('Serena Lite Code Outliner', () => {
  it('extracts TypeScript interfaces, classes, and methods with line numbers', () => {
    const tsCode = `
export interface UserConfig {
  id: string;
  timeout: number;
}

export class UserService {
  private cache: Map<string, any>;

  constructor(private config: UserConfig) {
    this.cache = new Map();
  }

  async getUser(id: string): Promise<User> {
    // 50 lines of complex implementation...
    return {} as User;
  }

  static validate(id: string): boolean {
    return id.length > 0;
  }
}
`;

    const outline = generateCodeOutline(tsCode, 'src/user.ts');
    expect(outline).toContain('interface UserConfig');
    expect(outline).toContain('class UserService');
    expect(outline).toContain('async getUser(id: string)');
    expect(outline).toContain('static validate(id: string)');
    expect(outline).toContain('L2');
    expect(outline).toContain('L7');
    expect(outline).not.toContain('this.cache = new Map()');
  });

  it('extracts Python classes and functions', () => {
    const pyCode = `
class AuthHandler(BaseHandler):
    def __init__(self, secret: str):
        self.secret = secret

    @property
    def is_active(self) -> bool:
        return True

    async def authenticate(self, token: str) -> Optional[User]:
        # 100 lines of complex crypto verification...
        pass
`;

    const outline = generateCodeOutline(pyCode, 'auth.py');
    expect(outline).toContain('class AuthHandler(BaseHandler)');
    expect(outline).toContain('def __init__(self, secret: str)');
    expect(outline).toContain('async def authenticate(self, token: str)');
    expect(outline).not.toContain('self.secret = secret');
  });

  it('extracts Go structs and funcs', () => {
    const goCode = `
type ServerConfig struct {
    Port int
}

func NewServer(cfg ServerConfig) *Server {
    return &Server{}
}

func (s *Server) Start() error {
    return nil
}
`;

    const outline = generateCodeOutline(goCode, 'server.go');
    expect(outline).toContain('type ServerConfig struct');
    expect(outline).toContain('func NewServer(cfg ServerConfig) *Server');
    expect(outline).toContain('func (s *Server) Start() error');
  });
});
