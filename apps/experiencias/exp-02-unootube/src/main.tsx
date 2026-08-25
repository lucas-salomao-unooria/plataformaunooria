import React from "react";
import { createRoot } from "react-dom/client";

import "./estilos/globals.css";
import { Bootstrap } from "./bootstrap";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
);
