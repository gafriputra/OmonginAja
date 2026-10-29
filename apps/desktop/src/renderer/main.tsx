import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Overlay } from "./Overlay";
import "./styles.css";

const isOverlay = window.location.hash === "#overlay";
document.body.classList.toggle("overlay", isOverlay);
createRoot(document.getElementById("root")!).render(isOverlay ? <Overlay /> : <App />);
