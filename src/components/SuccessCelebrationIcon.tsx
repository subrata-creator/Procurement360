import { CheckCircle2 } from "lucide-react";
import "../Styles/SuccessCelebrationIcon.css";

/**
 * Animated green checkmark circle with expanding ripple rings and floating
 * celebratory bubbles for PR and RFQ creation confirmation modals.
 */
export default function SuccessCelebrationIcon() {
  return (
    <div className="success-celebration-stage" aria-hidden="true">
      <span className="success-celebration-ring ring-1" />
      <span className="success-celebration-ring ring-2" />
      <span className="success-bubble b1" />
      <span className="success-bubble b2" />
      <span className="success-bubble b3" />
      <span className="success-bubble b4" />
      <span className="success-bubble b5" />
      <span className="success-bubble b6" />
      <span className="success-bubble b7" />
      <div className="success-celebration-circle">
        <CheckCircle2 size={40} className="success-celebration-check" />
      </div>
    </div>
  );
}

