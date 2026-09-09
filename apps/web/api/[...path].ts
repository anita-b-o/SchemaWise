import { createProxyHandler } from "./_proxy-core.js";

export const maxDuration = 300;

const proxy = createProxyHandler({ environment: process.env });

export default {
  fetch(request: Request): Promise<Response> {
    return proxy(request);
  },
};
