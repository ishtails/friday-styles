import { getAuthenticatedClient } from "@/lib/utils/google-auth.ts";

await getAuthenticatedClient();
console.log("Google login successful!.");
process.exit(0);
