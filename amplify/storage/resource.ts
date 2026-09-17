import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "appStorage",
  access: (allow) => ({
    "user-images/*": [
      allow.authenticated.to(["read", "write", "delete"]),
    ],
  }),
});
