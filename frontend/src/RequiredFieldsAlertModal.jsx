export default function RequiredFieldsAlertModal({ message, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card workspace-modal workspace-modal--confirm workspace-modal--alert"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-describedby="required-fields-alert-message"
      >
        <div className="workspace-modal--confirm__body workspace-modal--alert__body">
          <p id="required-fields-alert-message" className="workspace-modal--alert__message">
            {message}
          </p>
          <div className="workspace-modal--confirm__actions">
            <button type="button" className="primary-button" onClick={onClose}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
