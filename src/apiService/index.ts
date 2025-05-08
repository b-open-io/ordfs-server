import { api } from "encore.dev/api";
// import server from "../server.js"; // Commented out Express app import
// import type { IncomingMessage, ServerResponse } from "node:http"; // Commented out http types

/*
export const hello = api({ expose: true, method: "GET", path: "/encore-test" }, async () => {
    await Promise.resolve();
    // Return a slightly more complex object
    return {
        message: "Hello from native Encore!",
        data: {
            height: 123,
            hash: "abc",
            timestamp: Date.now()
        },
        status: "OK"
    };
});
*/

// Ensure Express app can handle requests forwarded by Encore
// This might require prototype adjustments depending on Express/Encore interaction
// Object.setPrototypeOf(IncomingMessage.prototype, server.request);
// Object.setPrototypeOf(ServerResponse.prototype, server.response);

/*
export const fallback = api.raw(
    {
        expose: true,
        method: "*", // Catch all methods
        path: "/!path", // Encore's wildcard fallback path
    },
    async (req: IncomingMessage, resp: ServerResponse) => {
        // Directly pass the request to the Express app instance
        server(req, resp);
    }
); 
*/
