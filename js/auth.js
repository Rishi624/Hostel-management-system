import { supabase } from './supabase.js';

const loginForm = document.getElementById('login-form');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const button = loginForm.querySelector('button');
    
    button.textContent = "Logging in...";
    button.disabled = true;

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (authError) {
        alert("Login failed: " + authError.message);
        button.textContent = "Sign In";
        button.disabled = false;
        return;
    }

    // 2. Fetch the user's role from our public Students table
    const { data: studentData, error: dbError } = await supabase
        .from('Students')
        .select('role')
        .eq('email', email)
        .single(); // Gets exactly one row

    if (dbError) {
        console.error("Could not find user role in database", dbError);
        alert("Account setup incomplete. Contact support.");
        return;
    }

    // 3. Route them to the correct dashboard!
    if (studentData.role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'index.html';
    }
});