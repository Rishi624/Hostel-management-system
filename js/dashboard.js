import { supabase } from './supabase.js';

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

async function loadAvailableRooms() {
    const { data: rooms, error } = await supabase
        .from('Rooms')
        .select(`
            room_number,
            status,
            Room_Types ( sharing_type, ac_type, price_per_month )
        `)
        .eq('status', 'Available');

    const roomList = document.getElementById('room-list');
    roomList.innerHTML = '';

    if (error) {
        console.error('Error fetching rooms:', error);
        roomList.innerHTML = '<li>Unable to load room data. Please try again later.</li>';
        return;
    }

    if (!rooms || rooms.length === 0) {
        roomList.innerHTML = '<li>No rooms available right now.</li>';
        return;
    }

    rooms.forEach(room => {
        const li = document.createElement('li');
        li.textContent = `Room ${room.room_number} - ${room.Room_Types?.ac_type ?? 'N/A'} - ₹${room.Room_Types?.price_per_month ?? 'N/A'}/mo`;
        roomList.appendChild(li);
    });
}

async function init() {
    const user = await checkUser();
    if (!user) return;
    await loadAvailableRooms();
}

init();