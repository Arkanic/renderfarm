export enum ModalSize {
    Small = 0,
    Normal,
    Large
}

const sizeClasses = ["modal-sm", "", "modal-lg"];

export function createModal(content:HTMLElement, title?:string, size:ModalSize = ModalSize.Normal) {
    let modalBox = document.createElement("div");
    modalBox.classList.add("modal", "fade", "show");
    modalBox.role = "dialog";
    modalBox.style.display = "block";

    let backdrop = document.createElement("div");
    backdrop.classList.add("modal-backdrop", "fade", "show");

    let modalDialog = document.createElement("div");
    modalDialog.classList.add("modal-dialog", sizeClasses[size]);

    let modalContent = document.createElement("div");
    modalContent.classList.add("modal-content");

    let modalHeader = document.createElement("div");
    modalHeader.classList.add("modal-header");

    if(typeof title !== "undefined") {
        let modalTitle = document.createElement("h5");
        modalTitle.classList.add("modal-title");
        modalTitle.textContent = title;
        modalHeader.appendChild(modalTitle);
    }

    modalContent.appendChild(modalHeader);

    let modalBody = document.createElement("div");
    modalBody.classList.add("modal-body");
    modalBody.appendChild(content);

    modalContent.appendChild(modalBody);

    let modalFooter = document.createElement("div");
    modalFooter.classList.add("modal-footer");

    let modalCloseBlock = document.createElement("button");
    modalCloseBlock.type = "button";
    modalCloseBlock.classList.add("btn", "btn-primary");
    modalCloseBlock.setAttribute("data-dismiss", "modal");
    modalCloseBlock.innerText = "Close";
    modalCloseBlock.addEventListener("click", () => {
        backdrop.style.display = "none";
        modalBox.style.display = "none";
        modalBox.classList.remove("show");
        setTimeout(() => {
            modalBox.parentNode?.removeChild(modalBox);
        }, 1000);
    });

    modalFooter.appendChild(modalCloseBlock);
    modalContent.appendChild(modalFooter);
    modalDialog.appendChild(modalContent);
    modalBox.appendChild(modalDialog);

    document.body.appendChild(modalBox);

    document.body.appendChild(backdrop);
}