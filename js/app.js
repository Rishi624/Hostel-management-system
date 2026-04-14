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

    // --- STEP 0: AUTHENTICATION (Login / Sign Up) ---

    // Make the toggle action a reusable function
    function setAuthMode(signUpMode) {
        isSignUp = signUpMode;
        document.getElementById('auth-title').innerText = isSignUp ? 'Create Account' : 'Welcome Back';
        document.getElementById('name-field').style.display = isSignUp ? 'block' : 'none';
        toggleAuthBtn.innerText = isSignUp ? 'Already have an account? Log In.' : 'Need an account? Sign Up here.';
        authBtn.innerText = isSignUp ? 'Sign Up' : 'Authenticate';
    }

    // Listen for clicks on the toggle text
    toggleAuthBtn.addEventListener('click', () => {
        setAuthMode(!isSignUp); // Flip the current mode
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
            // --- REGISTRATION LOGIC ---
            const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
            
            if (authError) {
                // Check if the error is because they already exist!
                if (authError.message.toLowerCase().includes('already registered')) {
                    alert("This email is already registered! Switching you to Login mode.");
                    setAuthMode(false); // Auto-switch to login!
                    return resetAuthButton('Authenticate');
                } else {
                    resetAuthButton('Sign Up');
                    return alert(authError.message);
                }
            }

            const userId = authData.user?.id;
            if (!userId) {
                resetAuthButton('Sign Up');
                return alert('Unable to create account at this time.');
            }

            // Add to our custom Students table
            const { error: insertError } = await supabase.from('Students').insert([{ student_id: userId, name, email }]);
            if (insertError) {
                // Important: If they delete the user in Auth but not the table, this catches it
                console.error(insertError);
                resetAuthButton('Sign Up');
                return alert('Could not save your profile. Note: If you manually deleted this user recently, ensure they are also deleted from the Students table.');
            }

            currentStudent = { student_id: userId, name, email };
            goToStep('step-type');

        } else {
            // --- LOGIN LOGIC ---
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
                resetAuthButton('Authenticate');
                return alert("Invalid email or password. Please try again.");
            }

            // Fetch their role/details
            const { data: studentData, error: studentError } = await supabase
                .from('Students')
                .select('*')
                .eq('email', email)
                .single();

            if (studentError || !studentData) {
                resetAuthButton('Authenticate');
                return alert('Unable to retrieve your account details. Please contact support.');
            }

            // Admin check
            if (studentData.role === 'admin') {
                window.location.href = 'admin.html';
                return;
            }

            // Student Reservation check
            currentStudent = studentData;
            const { data: resData, error: reservationError } = await supabase
                .from('Reservations')
                .select('Rooms(room_number)')
                .eq('student_id', currentStudent.student_id)
                .single();

            if (reservationError && reservationError.code !== 'PGRST116') {
                resetAuthButton('Authenticate');
                return alert('Error checking reservation status. Please try again.');
            }

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

        const { data: rooms, error } = await supabase
            .from('Rooms')
            .select('room_id, room_number, Room_Types!inner(sharing_type, ac_type, price_per_month)')
            .eq('status', 'Available')
            .eq('Room_Types.sharing_type', sharingPref)
            .eq('Room_Types.ac_type', acPref);

        grid.innerHTML = '';
        document.getElementById('proceed-checkout-btn').disabled = true;

        if (error) {
            console.error(error);
            statusText.innerText = 'Unable to access corridors. Please try again later.';
            return;
        }

        if (!rooms || rooms.length === 0) {
            statusText.innerText = 'All doors are locked. No rooms available for these preferences.';
            return;
        }

        statusText.innerText = `Found ${rooms.length} unlocked doors matching your criteria.`;
        
        rooms.forEach(room => {
            // Create the Door Frame
            const frame = document.createElement('div');
            frame.className = 'door-frame';

            // Create the swinging door panel
            const door = document.createElement('div');
            door.className = 'door-panel';
            
            // Create the Room Number Plaque
            const plaque = document.createElement('div');
            plaque.className = 'door-plaque';
            plaque.innerText = room.room_number;

            // Assemble the door
            door.appendChild(plaque);
            frame.appendChild(door);

            // Click Logic
            door.onclick = () => {
                // Remove 'selected' from all doors
                document.querySelectorAll('.door-panel').forEach(d => d.classList.remove('selected'));
                // Add 'selected' to this door to trigger the wide-open animation
                door.classList.add('selected');
                selectedRoomData = room;
                document.getElementById('proceed-checkout-btn').disabled = false;
            };
            
            grid.appendChild(frame);
        });
    });

    // --- STEP 2: PROCEED TO CHECKOUT ---
    document.getElementById('proceed-checkout-btn').addEventListener('click', () => {
        if (!selectedRoomData || !selectedRoomData.Room_Types) {
            return alert('Please select a room before proceeding.');
        }

        const rent = Number(selectedRoomData.Room_Types.price_per_month) || 0;
        document.getElementById('checkout-room').innerText = selectedRoomData.room_number;
        document.getElementById('checkout-rent').innerText = rent;
        document.getElementById('checkout-total').innerText = rent + 10000;
        goToStep('step-pay');
    });

    // --- STEP 3: SIMULATE PAYMENT & SAVE TO DATABASE ---
    document.getElementById('pay-btn').addEventListener('click', async () => {
        if (!currentStudent || !selectedRoomData) {
            return alert('No booking available. Please begin again.');
        }

        const btn = document.getElementById('pay-btn');
        btn.innerText = 'Processing Payment...';
        btn.disabled = true;

        const { error: roomError } = await supabase
            .from('Rooms')
            .update({ status: 'Full' })
            .eq('room_id', selectedRoomData.room_id);
        if (roomError) {
            btn.disabled = false;
            btn.innerText = 'Confirm & Pay';
            return alert('Unable to update room status: ' + roomError.message);
        }

        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

        const { error: reservationError } = await supabase.from('Reservations').insert([{ 
            student_id: currentStudent.student_id, 
            room_id: selectedRoomData.room_id, 
            start_date: startDate, 
            end_date: endDate 
        }]);
        if (reservationError) {
            btn.disabled = false;
            btn.innerText = 'Confirm & Pay';
            return alert('Unable to create reservation: ' + reservationError.message);
        }

        const { error: depositError } = await supabase.from('Deposits').insert([{ 
            student_id: currentStudent.student_id, 
            amount_paid: 10000 
        }]);
        if (depositError) {
            btn.disabled = false;
            btn.innerText = 'Confirm & Pay';
            return alert('Unable to register deposit: ' + depositError.message);
        }

        document.getElementById('dash-name').innerText = currentStudent.name;
        document.getElementById('dash-email').innerText = currentStudent.email;
        document.getElementById('dash-room').innerText = selectedRoomData.room_number;
        
        goToStep('step-dashboard');
    });

    // --- NAVIGATION BACK BUTTONS ---
    document.getElementById('back-to-types').addEventListener('click', () => goToStep('step-type'));
    document.getElementById('back-to-rooms').addEventListener('click', () => goToStep('step-room'));

    // --- LOGOUT ---
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.reload();
    });

    // --- HAND IN KEY (FREE ROOM) ---
document.getElementById('hand-key-btn').addEventListener('click', async () => {
    // 1. Confirm they actually want to do this
    const confirmCheckout = confirm("Are you sure you want to hand in your key? This will permanently free up your room.");
    if (!confirmCheckout) return;

    const btn = document.getElementById('hand-key-btn');
    btn.innerText = "Processing...";
    btn.disabled = true;

    // 2. Look up the student's current active reservation
    const { data: resData, error: fetchError } = await supabase
        .from('Reservations')
        .select('reservation_id, room_id')
        .eq('student_id', currentStudent.student_id)
        .single();

    if (fetchError || !resData) {
        alert("Could not find an active room reservation to cancel.");
        btn.innerText = "Hand in Key";
        btn.disabled = false;
        return;
    }

    // 3. Mark the Room as 'Available' again
    const { error: roomError } = await supabase
        .from('Rooms')
        .update({ status: 'Available' })
        .eq('room_id', resData.room_id);

    if (roomError) {
        alert("Error freeing the room: " + roomError.message);
        btn.innerText = "Hand in Key";
        btn.disabled = false;
        return;
    }

    // 4. Delete the Reservation record so the student is free to book again
    await supabase.from('Reservations').delete().eq('reservation_id', resData.reservation_id);
    
    alert("Key returned successfully. The room is now available for others.");
    
    // 5. Reload the page to send them back to the beginning
    window.location.reload(); 
});