function getRandomFromArray(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateRandomPassword() {
    const word1 = ["happy", "clever", "brave", "bright", "swift"];
    const word2 = ["tiger", "moon", "star", "river", "mountain"];
    const moreWords = ["super", "mega", "ultra", "hyper", "power"];
    const numbers = Math.floor(Math.random() * 1000);
    
    const pass1 = getRandomFromArray(word1);
    const pass2 = getRandomFromArray(word2);
    const pass3 = getRandomFromArray(moreWords);
    
    return `${pass1}${pass2}${pass3}${numbers}`;
}

document.getElementById('generatePassword').addEventListener('click', () => {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const generatedPassword = document.getElementById('generatedPassword');
    const generated = generateRandomPassword();
    
    password.value = ''; 
    confirmPassword.value = '';
    generatedPassword.textContent = `Generated Password: ${generated}`;
    generatedPassword.style.color = "green";
    generatedPassword.style.display = 'block';
});

document.getElementById('generateUsername').addEventListener('click', async () => {
    const username = document.getElementById('username');
    const generatedUsername = document.getElementById('generatedUsername');
    
    const response = await fetch('https://randomuser.me/api/');
    const data = await response.json();
    const generated = data.results[0].login.username;
    
    username.value = '';  
    generatedUsername.textContent = `Generated Username: ${generated}`;
    generatedUsername.style.color = "orange";
    generatedUsername.style.display = 'block';
});

document.querySelector('form').addEventListener('submit', (e) => {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    const feedback = document.getElementById('feedback');
    
    if (!username || !password || !confirmPassword) {
        e.preventDefault();
        feedback.textContent = 'Please fill all fields';
        feedback.style.color = "red";
        feedback.style.display = 'block';
    } else if (password !== confirmPassword) {
        e.preventDefault();
        feedback.textContent = 'Passwords do not match';
        feedback.style.color = "red";
        feedback.style.display = 'block';
    }
})