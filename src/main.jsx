import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PropertyCopilot_Demo from "./components/PropertyCopilot_Demo.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PropertyCopilot_Demo />
  </StrictMode>
);
