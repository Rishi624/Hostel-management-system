import { supabase } from './supabase.js';

async function checkAdminAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

const addRoomForm = document.getElementById('add-room-form');

addRoomForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const roomNumber = document.getElementById('room-number').value.trim();
    const sharingType = document.getElementById('sharing-type').value.trim();
    const acType = document.getElementById('ac-type').value;
    const price = Number(document.getElementById('price').value);

    const { data: typeData, error: typeError } = await supabase
        .from('Room_Types')
        .insert([{ 
            sharing_type: sharingType, 
            ac_type: acType, 
            price_per_month: price 
        }])
        .select()
        .single();

    if (typeError || !typeData?.room_type_id) {
        alert('Error creating room type: ' + (typeError?.message ?? 'Unknown error'));
        return;
    }

    const { error: roomError } = await supabase
        .from('Rooms')
        .insert([{ 
            room_number: roomNumber, 
            room_type_id: typeData.room_type_id 
        }]);

    if (roomError) {
        alert('Error creating room: ' + roomError.message);
        return;
    }

    alert('Room added successfully!');
    addRoomForm.reset();
    loadAllRooms();
});

async function loadAllRooms() {
    const { data: rooms, error } = await supabase
        .from('Rooms')
        .select('room_number, status, Room_Types (sharing_type, ac_type, price_per_month)');

    const list = document.getElementById('admin-room-list');
    list.innerHTML = '';

    if (error) {
        list.innerHTML = '<li>Unable to load rooms at this time.</li>';
        console.error(error);
        return;
    }

    if (!rooms || rooms.length === 0) {
        list.innerHTML = '<li>No rooms found yet.</li>';
        return;
    }

    rooms.forEach(room => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>Room ${room.room_number}</strong> - ${room.Room_Types?.ac_type ?? 'N/A'} (${room.Room_Types?.sharing_type ?? 'N/A'} share) - ₹${room.Room_Types?.price_per_month ?? 'N/A'} <br><small>Status: ${room.status}</small>`;
        list.appendChild(li);
    });
}

async function initAdmin() {
    const isAuth = await checkAdminAuth();
    if (!isAuth) return;
    await loadAllRooms();
}

initAdmin();

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
});