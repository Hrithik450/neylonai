// next-auth.d.ts

import { DefaultSession } from "next-auth";

/**
 * We are augmenting the default types from next-auth to include our custom data.
 */

declare module "next-auth" {
  /**
   * The "User" object is the shape of the object returned by the `authorize` function.
   * This is the data that will be used to create the JWT.
   */
  interface User {
    id: string;
    tokens: number;
  }

  /**
   * The "Session" object is what you get when you call `auth()` or `useSession()`.
   * We extend the default session to add our custom properties to the `user` object.
   */
  interface Session {
    user: {
      id: string;
      tokens: number;
    } & DefaultSession["user"]; // This keeps the default `name`, `email`, `image`
  }
}
