interface CommonModalProps {
  open?: boolean;
}

export interface ModalProps extends CommonModalProps {}

function defineComponent<T>(render: (props: T) => unknown) {
  return render;
}

const Modal = defineComponent<ModalProps>(({ open = false }) => (
  <div data-open={open} />
));

export default Modal;
