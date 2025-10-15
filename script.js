const whatsappButton = document.getElementById('whatsappButton');
const whatsappForm = document.getElementById('whatsappForm');
const sendButton = document.getElementById('sendButton');
const nameInput = document.getElementById('nameInput');

// Toggle form visibility
whatsappButton.addEventListener('click', () => {
    whatsappForm.classList.toggle('active');
});

// Send message
sendButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
    alert('Por favor, insira seu nome!');
    return;
    }

    const phoneNumber = '5551985451245'; // <-- replace with your WhatsApp number
    const message = encodeURIComponent(`Olá, meu nome é ${name}!`);
    const url = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(url, '_blank');
});