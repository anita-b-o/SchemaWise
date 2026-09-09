export interface User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PublicUser {
  readonly id: string;
  readonly email: string;
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email };
}
