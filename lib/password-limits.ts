// How long a password may be: Better Auth's own limits (it refuses outside 8 to 128), and
// the 8 the sign-up form already asks for. Apart from the server code so the Account
// page's form can use the same numbers.

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
