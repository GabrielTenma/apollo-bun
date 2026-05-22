import React from "react";
// @ts-expect-error: react-dom/client type declarations are not available in this setup.
import ReactDOM from "react-dom/client";
import App from "./App";
// @ts-expect-error: side-effect import of CSS without type declarations
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
