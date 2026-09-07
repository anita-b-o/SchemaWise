import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function BaselineMessage() {
  return <p>SchemaWise baseline</p>;
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("SchemaWise web root was not found");
}

createRoot(root).render(
  <StrictMode>
    <BaselineMessage />
  </StrictMode>
);
