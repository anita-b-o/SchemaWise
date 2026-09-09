import type { User } from "../model/user.js";

export type CreateUserResult = { readonly kind: "created" } | { readonly kind: "duplicate-email" };

export interface UserRepository {
  create(user: User): Promise<CreateUserResult>;
  findByCanonicalEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
}
