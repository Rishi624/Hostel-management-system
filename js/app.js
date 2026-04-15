import { supabase } from './supabase.js';

// State Variables
let isSignUp = false;
let currentStudent = null;
let selectedRoomData = null;

// DOM Elements
const steps = document.querySelectorAll('.step');
const authForm = document.getElementById('auth-form');
const authBtn = document.getElementById('auth-btn');
const toggleAuthBtn = document.getElementById('toggle-auth-btn');

// --- WIZARD NAVIGATION LOGIC ---
function goToStep(stepId) {
    steps.forEach(el => el.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
}

// --- STEP 0: AUTHENTICATION ---
function setAuthMode(signUpMode) {
    isSignUp = signUpMode;
    document.getElementById('auth-title').innerText = isSignUp ? 'Create Account' : 'Welcome Back';
    document.getElementById('name-field').style.display = isSignUp ? 'block' : 'none';
    toggleAuthBtn.innerText = isSignUp ? 'Already have an account? Log In.' : 'Need an account? Sign Up here.';
    authBtn.innerText = isSignUp ? 'Sign Up' : 'Authenticate';
}

toggleAuthBtn.addEventListener('click', () => {
    setAuthMode(!isSignUp);
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authBtn.disabled = true;
    authBtn.innerText = 'Processing...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value.trim();

    const resetAuthButton = (text) => {
        authBtn.disabled = false;
        authBtn.innerText = text;
    };

    if (isSignUp) {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

        if (authError) {
            if (authError.message.toLowerCase().includes('already registered')) {
                alert("This email is already registered! Switching you to Login mode.");
                setAuthMode(false);
                return resetAuthButton('Authenticate');
            }
            resetAuthButton('Sign Up');
            return alert(authError.message);
        }

        const userId = authData.user?.id;
        if (!userId) {
            resetAuthButton('Sign Up');
            return alert('Unable to create account.');
        }

        const { error: insertError } = await supabase
            .from('Students')
            .insert([{ student_id: userId, name, email }]);

        if (insertError) {
            resetAuthButton('Sign Up');
            return alert('Could not save your profile.');
        }

        currentStudent = { student_id: userId, name, email };
        goToStep('step-type');

    } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            resetAuthButton('Authenticate');
            return alert("Invalid email or password.");
        }

        const { data: studentData, error: studentError } = await supabase
            .from('Students')
            .select('*')
            .eq('email', email)
            .single();

        if (studentError || !studentData) {
            resetAuthButton('Authenticate');
            return alert('Unable to retrieve account.');
        }

        // ADMIN CHECK (kept intact)
        if (studentData.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }

        currentStudent = studentData;

        const { data: resData, error: reservationError } = await supabase
            .from('Reservations')
            .select('Rooms(room_number)')
            .eq('student_id', currentStudent.student_id)
            .single();

        if (resData) {
            document.getElementById('dash-name').innerText = currentStudent.name;
            document.getElementById('dash-email').innerText = currentStudent.email;
            document.getElementById('dash-room').innerText = resData.Rooms?.room_number ?? 'N/A';
            goToStep('step-dashboard');
        } else {
            goToStep('step-type');
        }
    }
});

// --- STEP 1: FIND ROOMS ---
document.getElementById('find-rooms-btn').addEventListener('click', async () => {
    const sharingPref = document.getElementById('sharing-select').value;
    const acPref = document.getElementById('ac-select').value;
    const grid = document.getElementById('room-grid');
    const statusText = document.getElementById('room-status-text');

    grid.innerHTML = 'Loading corridors...';
    goToStep('step-room');

    // ✅ IMPORTANT FIX: include current_occupancy
    const { data: rooms, error } = await supabase
        .from('Rooms')
        .select('room_id, room_number, current_occupancy, Room_Types!inner(sharing_type, ac_type, price_per_month)')
        .eq('status', 'Available')
        .eq('Room_Types.sharing_type', sharingPref)
        .eq('Room_Types.ac_type', acPref);

    grid.innerHTML = '';
    document.getElementById('proceed-checkout-btn').disabled = true;

    if (error) {
        statusText.innerText = 'Unable to access corridors.';
        return;
    }

    if (!rooms || rooms.length === 0) {
        statusText.innerText = 'No rooms available.';
        return;
    }

    statusText.innerText = `Found ${rooms.length} rooms matching your criteria.`;

    rooms.forEach(room => {
        // ✅ FIX 1: calculate beds left
        const bedsLeft = room.Room_Types.sharing_type - room.current_occupancy;

        const frame = document.createElement('div');
        frame.className = 'door-frame';

        const door = document.createElement('div');
        door.className = 'door-panel';

        const plaque = document.createElement('div');
        plaque.className = 'door-plaque';

        plaque.innerHTML = `
            ${room.room_number}<br>
            <span style="font-size:0.8rem;">(${bedsLeft} beds left)</span>
        `;

        door.appendChild(plaque);
        frame.appendChild(door);

        door.onclick = () => {
            document.querySelectorAll('.door-panel').forEach(d => d.classList.remove('selected'));
            door.classList.add('selected');
            selectedRoomData = room;
            document.getElementById('proceed-checkout-btn').disabled = false;
        };

        grid.appendChild(frame);
    });
});

// --- STEP 2 ---
document.getElementById('proceed-checkout-btn').addEventListener('click', () => {
    if (!selectedRoomData) return alert('Select a room.');

    const rent = Number(selectedRoomData.Room_Types.price_per_month);

    document.getElementById('checkout-room').innerText = selectedRoomData.room_number;
    document.getElementById('checkout-rent').innerText = rent;
    document.getElementById('checkout-total').innerText = rent + 10000;

    goToStep('step-pay');
});

// --- STEP 3: PAYMENT ---
document.getElementById('pay-btn').addEventListener('click', async () => {
    const btn = document.getElementById('pay-btn');
    btn.innerText = 'Processing...';
    btn.disabled = true;

    // ✅ FIX 2: proper occupancy math
    const newOccupancy = selectedRoomData.current_occupancy + 1;
    const isNowFull = newOccupancy >= selectedRoomData.Room_Types.sharing_type;

    const { error: roomError } = await supabase
        .from('Rooms')
        .update({
            current_occupancy: newOccupancy,
            status: isNowFull ? 'Full' : 'Available'
        })
        .eq('room_id', selectedRoomData.room_id);

    if (roomError) {
        btn.disabled = false;
        btn.innerText = 'Confirm & Pay';
        return alert(roomError.message);
    }

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        .toISOString().split('T')[0];

    await supabase.from('Reservations').insert([{
        student_id: currentStudent.student_id,
        room_id: selectedRoomData.room_id,
        start_date: startDate,
        end_date: endDate
    }]);

    await supabase.from('Deposits').insert([{
        student_id: currentStudent.student_id,
        amount_paid: 10000
    }]);

    goToStep('step-dashboard');
});

// --- BACK BUTTONS ---
document.getElementById('back-to-types').addEventListener('click', () => goToStep('step-type'));
document.getElementById('back-to-rooms').addEventListener('click', () => goToStep('step-room'));

// --- LOGOUT ---
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
});

// --- HAND IN KEY ---
document.getElementById('hand-key-btn').addEventListener('click', async () => {
    if (!confirm("Are you sure?")) return;

    const btn = document.getElementById('hand-key-btn');
    btn.innerText = "Processing...";
    btn.disabled = true;

    const { data: resData } = await supabase
        .from('Reservations')
        .select('reservation_id, room_id')
        .eq('student_id', currentStudent.student_id)
        .single();

    // ✅ FIX 3: fetch + decrement safely
    const { data: roomInfo } = await supabase
        .from('Rooms')
        .select('current_occupancy')
        .eq('room_id', resData.room_id)
        .single();

    const newOccupancy = Math.max(0, roomInfo.current_occupancy - 1);

    await supabase
        .from('Rooms')
        .update({
            current_occupancy: newOccupancy,
            status: 'Available'
        })
        .eq('room_id', resData.room_id);

    await supabase
        .from('Reservations')
        .delete()
        .eq('reservation_id', resData.reservation_id);

    alert("Room freed.");
    window.location.reload();
});