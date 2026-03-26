import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import AccessGate from "./components/AccessGate.jsx";
import PropertyCopilot_Demo from "./components/PropertyCopilot_Demo.jsx";

function App() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem("loxley_access") === "1"
  );

  if (!authenticated) {
    return <AccessGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <PropertyCopilot_Demo />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
