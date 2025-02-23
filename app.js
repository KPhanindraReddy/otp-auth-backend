function sendOTP() {
    const email = document.getElementById("email").value;
    const messageElement = document.getElementById("message");

    if (!email) {
        messageElement.innerText = "Please enter an email.";
        return;
    }

    fetch("http://127.0.0.1:3000/send-otp", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            messageElement.innerText = `OTP sent successfully to ${email}`;
        } else {
            messageElement.innerText = "Error sending OTP: " + data.message;
        }
    })
    .catch(error => {
        messageElement.innerText = "Error sending OTP: " + error.message;
        console.error("Error:", error);
    });
}
