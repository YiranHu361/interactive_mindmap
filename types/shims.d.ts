declare module 'react/jsx-runtime' {
  const content: any
  export default content
}

declare module 'next/server' {
  export const NextResponse: any
}

declare module 'next-auth' {
  export type NextAuthConfig = any
  const NextAuth: any
  export default NextAuth
}

declare module 'openai' {
  export default class OpenAI {
    constructor(config: { apiKey: string })
    chat: { completions: { create(input: any): Promise<any> } }
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any
  }
}


