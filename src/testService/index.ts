import { api } from "encore.dev/api";

export const testEndpoint = api({ expose: true, method: "GET", path: "/isolated-test" }, () => {
    return { result: "Hello from isolated service!" };
}); 