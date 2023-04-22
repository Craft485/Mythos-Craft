async function attemptLogin() {
    // Send a POST request via the fetch api with username and password
    // Assume we are using ssl so password can be sent via plaintext as it'll be hashed server side

    const username: string = document.querySelector<HTMLInputElement>('#username').value
    const password: string = document.querySelector<HTMLInputElement>('#password').value

    if (!username || !password) {
        document.getElementById('form').style.backgroundColor = 'red'
        return
    }

    const res = await fetch(`signup?u=${username}&p=${password}`, { method: "POST" })
    res.json().then(async (data: { status: string, success: boolean }) => {
        if (data.success) {
            // Signup successful, send login request?
            document.getElementById('submit').click()
        }
        console.log(data)
    })
}

window.onload = () => {
    document.getElementById('btn').onclick = attemptLogin
}