const whatsappButton = document.getElementById('whatsappButton');
const whatsappForm = document.getElementById('whatsappForm');
const sendButton = document.getElementById('sendButton');
const nameInput = document.getElementById('nameInput');
const rua = document.getElementById('rua-wa');
const numero = document.getElementById('num-wa');
const bairro = document.getElementById('bairro-wa');
const cidade = document.getElementById('cidade-wa');

whatsappButton.addEventListener('click', () => {
    whatsappForm.classList.toggle('active');
});

sendButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
    alert('Por favor, insira seu nome!');
    return;
    }

    if (!rua.value || !numero.value || !bairro.value || !cidade.value) {
        const phoneNumber = '5551985451245';
        const message = encodeURIComponent(`Olá, meu nome é ${name}!`);
        const url = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(url, '_blank');}
    else {
        const phoneNumber = '5551985451245';
        const message = encodeURIComponent(`Olá, meu nome é ${name}!`);
        const url = `https://wa.me/${phoneNumber}?text=${message}%0A%0AEndereço: ${rua.value}, ${numero.value}, ${bairro.value}, ${cidade.value}`;
        window.open(url, '_blank');
    }
});