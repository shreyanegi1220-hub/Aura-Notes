/**
 * Aura Notes - Creative Midnight Edition
 * Added: Triangle, Star, Rounded Rect, Sidebar Tasks, Daily Tracker logic
 */

let state = {
    notebooks: JSON.parse(localStorage.getItem('aura-notebooks')) || [
        { id: 'nb-1', name: 'Personal', color: '#ff0055' },
        { id: 'nb-2', name: 'Work', color: '#7000ff' }
    ],
    notes: JSON.parse(localStorage.getItem('aura-notes')) || [{
        id: '1', notebookId: 'nb-1', title: 'Creative Morning ✨', content: 'Doodle, write, and check off your tasks on the left!', drawing: null, pageStyle: 'blank', date: 'April 01, 2026', timestamp: Date.now()
    }],
    todos: JSON.parse(localStorage.getItem('aura-todos')) || [
        { id: 't1', text: 'Plan tomorrow', done: false },
        { id: 't2', text: 'Update journal', done: true }
    ],
    activeNotebookId: JSON.parse(localStorage.getItem('aura-active-nb')) || 'nb-1',
    activeNoteId: JSON.parse(localStorage.getItem('aura-active-note')) || '1',
    editMode: 'text',
    drawTool: 'pen'
};

const el = {
    notebookList: document.getElementById('notebook-list'),
    noteList: document.getElementById('note-list'),
    todoList: document.getElementById('todo-list'),
    todoInput: document.getElementById('todo-input'),
    newNoteBtn: document.getElementById('new-note-btn'),
    noteTitle: document.getElementById('note-title'),
    noteDate: document.getElementById('note-date'),
    editor: document.getElementById('editor'),
    editorWrapper: document.querySelector('.editor-wrapper'),
    canvas: document.getElementById('draw-canvas'),
    drawToolbar: document.getElementById('draw-toolbar'),
    textModeBtn: document.getElementById('text-mode-btn'),
    drawModeBtn: document.getElementById('draw-mode-btn'),
    saveBtn: document.getElementById('save-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    highlightBtn: document.getElementById('highlight-btn'),
    boldBtn: document.getElementById('bold-btn'),
    bulletBtn: document.getElementById('bullet-btn'),
    tickBtn: document.getElementById('tick-btn'),
    stylePicker: document.getElementById('style-picker'),
    search: document.getElementById('note-search'),
    toast: document.getElementById('toast'),
    colorSwatches: document.querySelectorAll('.color-swatch'),
    drawToolBtns: document.querySelectorAll('.draw-tool-btn'),
    brushSize: document.getElementById('brush-size'),
    clearDrawBtn: document.getElementById('clear-draw-btn')
};

const ctx = el.canvas.getContext('2d');
let isDrawing = false, startX = 0, startY = 0, lastX = 0, lastY = 0;
let currentColor = '#ff0055';
let canvasSnapshot = null;

// --- Initialization ---
function init() {
    renderNotebooks();
    renderNotes();
    renderTodos();
    loadActiveNote();
    setupEventListeners();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function setupEventListeners() {
    el.newNoteBtn.onclick = createNote;
    el.saveBtn.onclick = saveState;
    el.deleteBtn.onclick = deleteNote;
    el.highlightBtn.onclick = toggleHighlight;
    el.boldBtn.onclick = () => { document.execCommand('bold'); saveState(); };
    el.bulletBtn.onclick = () => { document.execCommand('insertUnorderedList'); saveState(); };
    el.tickBtn.onclick = insertCheckbox;
    el.textModeBtn.onclick = () => setEditMode('text');
    el.drawModeBtn.onclick = () => setEditMode('draw');
    el.search.oninput = (e) => renderNotes(e.target.value);
    el.clearDrawBtn.onclick = clearCanvas;

    // Sidebar Todos
    el.todoInput.onkeypress = (e) => {
        if (e.key === 'Enter' && el.todoInput.value.trim()) {
            state.todos.unshift({ id: Date.now(), text: el.todoInput.value, done: false });
            el.todoInput.value = ''; renderTodos(); saveState();
        }
    };

    el.drawToolBtns.forEach(btn => {
        btn.onclick = () => {
            el.drawToolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.drawTool = btn.dataset.tool;
        };
    });

    el.colorSwatches.forEach(sw => sw.onclick = () => {
        el.colorSwatches.forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        currentColor = sw.dataset.color;
    });

    el.stylePicker.onclick = (e) => {
        const btn = e.target.closest('.style-btn');
        if (btn) setPageStyle(btn.dataset.style);
    };

    let timer;
    el.editor.oninput = () => { clearTimeout(timer); timer = setTimeout(saveState, 1500); };
    el.noteTitle.oninput = () => { clearTimeout(timer); timer = setTimeout(saveState, 1500); };

    el.canvas.onmousedown = (e) => startDrawing(e);
    el.canvas.onmousemove = (e) => onDrawing(e);
    el.canvas.onmouseup = stopDrawing;
    el.canvas.onmouseout = stopDrawing;
}

// --- Sidebar Tasks ---
function renderTodos() {
    el.todoList.innerHTML = state.todos.map(t => `
        <li class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
            <input type="checkbox" ${t.done ? 'checked' : ''}>
            <span>${t.text}</span>
            <i data-lucide="x-circle" class="delete-task"></i>
        </li>
    `).join('');
    
    lucide.createIcons(); // Refresh icons for delete buttons

    el.todoList.querySelectorAll('.todo-item').forEach(item => {
        // Toggle Done
        item.onclick = (e) => {
            if (e.target.classList.contains('delete-task')) return;
            const id = item.dataset.id;
            const task = state.todos.find(t => t.id == id);
            if (task) { task.done = !task.done; renderTodos(); saveState(); }
        };

        // Delete Task
        const delBtn = item.querySelector('.delete-task');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.stopPropagation();
                const id = item.dataset.id;
                state.todos = state.todos.filter(t => t.id != id);
                renderTodos(); saveState();
            };
        }
    });
}

// --- Drawing Engine (Shapes Added) ---
function resizeCanvas() {
    const rect = el.editorWrapper.getBoundingClientRect();
    const data = el.canvas.toDataURL();
    el.canvas.width = rect.width;
    el.canvas.height = rect.height;
    if (data && data !== 'data:,') {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = data;
    }
}

function startDrawing(e) {
    if (state.editMode !== 'draw') return;
    isDrawing = true;
    const rect = el.canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    [lastX, lastY] = [startX, startY];
    canvasSnapshot = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height);
}

function onDrawing(e) {
    if (!isDrawing) return;
    const rect = el.canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    ctx.lineWidth = el.brushSize.value;
    ctx.lineCap = 'round';
    ctx.strokeStyle = currentColor;

    if (state.drawTool === 'pen' || state.drawTool === 'eraser') {
        ctx.globalCompositeOperation = (state.drawTool === 'eraser') ? 'destination-out' : 'source-over';
        if (state.drawTool === 'eraser') ctx.lineWidth = el.brushSize.value * 3;
        ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(curX, curY); ctx.stroke();
        [lastX, lastY] = [curX, curY];
    } else {
        ctx.putImageData(canvasSnapshot, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        if (state.drawTool === 'rect') ctx.strokeRect(startX, startY, curX - startX, curY - startY);
        else if (state.drawTool === 'circle') {
            const r = Math.sqrt(Math.pow(curX - startX, 2) + Math.pow(curY - startY, 2));
            ctx.arc(startX, startY, r, 0, 2*Math.PI); ctx.stroke();
        } else if (state.drawTool === 'triangle') {
            ctx.moveTo(startX + (curX - startX)/2, startY);
            ctx.lineTo(startX, curY);
            ctx.lineTo(curX, curY);
            ctx.closePath(); ctx.stroke();
        } else if (state.drawTool === 'star') {
            drawStar(startX, startY, 5, Math.abs(curX - startX), Math.abs(curX - startX)/2.5);
        }
    }
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx; let y = cy;
    let step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y); rot += step;
        x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y); rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius); ctx.closePath(); ctx.stroke();
}

function stopDrawing() { if (isDrawing) { isDrawing = false; saveState(); } }
function clearCanvas() { ctx.clearRect(0, 0, el.canvas.width, el.canvas.height); saveState(); }

// --- UI Management ---
function setActiveNote(id) {
    saveState(); state.activeNoteId = id; loadActiveNote(); renderNotes();
}

function loadActiveNote() {
    const note = state.notes.find(n => n.id === state.activeNoteId);
    if (!note) return;
    el.noteTitle.value = note.title || ''; el.editor.innerHTML = note.content || '';
    el.noteDate.innerText = note.date;
    setPageStyle(note.pageStyle || 'blank', false);
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    if (note.drawing) {
        const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = note.drawing;
    }
}

function saveState() {
    const note = state.notes.find(n => n.id === state.activeNoteId);
    if (note) { 
        note.title = el.noteTitle.value; note.content = el.editor.innerHTML;
        note.drawing = el.canvas.toDataURL(); note.timestamp = Date.now();
    }
    localStorage.setItem('aura-notebooks', JSON.stringify(state.notebooks));
    localStorage.setItem('aura-notes', JSON.stringify(state.notes));
    localStorage.setItem('aura-todos', JSON.stringify(state.todos));
    localStorage.setItem('aura-active-note', JSON.stringify(state.activeNoteId));
    localStorage.setItem('aura-active-nb', JSON.stringify(state.activeNotebookId));
}

function setEditMode(mode) {
    state.editMode = mode;
    el.textModeBtn.classList.toggle('active', mode === 'text');
    el.drawModeBtn.classList.toggle('active', mode === 'draw');
    el.canvas.classList.toggle('active', mode === 'draw');
    el.drawToolbar.classList.toggle('active', mode === 'draw');
    if (mode === 'draw') resizeCanvas();
}

function setPageStyle(style, save = true) {
    el.editorWrapper.className = 'editor-wrapper ' + style;
    const note = state.notes.find(n => n.id === state.activeNoteId);
    if (note) note.pageStyle = style;
    if (save) saveState();
}

function renderNotebooks() {
    el.notebookList.innerHTML = state.notebooks.map(nb => `
        <div class="notebook-item ${nb.id === state.activeNotebookId ? 'active' : ''}" data-id="${nb.id}">
            <div class="notebook-dot" style="background:${nb.color}"></div>
            <span>${nb.name}</span>
        </div>
    `).join('');
    el.notebookList.querySelectorAll('.notebook-item').forEach(i => i.onclick = () => {
        saveState(); state.activeNotebookId = i.dataset.id; renderNotebooks(); renderNotes();
        const nbNotes = state.notes.filter(n => n.notebookId === state.activeNotebookId);
        if (nbNotes.length > 0) setActiveNote(nbNotes[0].id); else createNote();
    });
}

function renderNotes(f = '') {
    const fil = state.notes.filter(n => n.notebookId === state.activeNotebookId && 
        (n.title.toLowerCase().includes(f.toLowerCase()) || n.content.toLowerCase().includes(f.toLowerCase())))
        .sort((a,b) => b.timestamp - a.timestamp);
    el.noteList.innerHTML = fil.map(n => `
        <div class="note-item ${n.id === state.activeNoteId ? 'active' : ''}" data-id="${n.id}">
            <h4>${n.title || 'Untitled'}</h4>
            <p>${n.date}</p>
        </div>
    `).join('');
    el.noteList.querySelectorAll('.note-item').forEach(i => i.onclick = () => setActiveNote(i.dataset.id));
}

function createNote() {
    saveState(); const id = Date.now().toString();
    const newNote = { id, notebookId: state.activeNotebookId, title: '', content: '', drawing: null, pageStyle: 'blank', date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), timestamp: Date.now() };
    state.notes.unshift(newNote); state.activeNoteId = id; loadActiveNote(); renderNotes(); saveState();
}

function deleteNote() {
    if (confirm('Delete?')) {
        state.notes = state.notes.filter(n => n.id !== state.activeNoteId);
        const rem = state.notes.filter(n => n.notebookId === state.activeNotebookId);
        if (rem.length > 0) setActiveNote(rem[0].id); else createNote();
    }
}

function toggleHighlight() {
    const s = window.getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0), m = document.createElement('mark');
    try { r.surroundContents(m); } catch(e) { m.appendChild(r.extractContents()); r.insertNode(m); }
    saveState(); s.removeAllRanges();
}

function insertCheckbox() {
    el.editor.focus();
    const html = `<div class="checkbox-item"><input type="checkbox"><span>&nbsp;</span></div>`;
    document.execCommand('insertHTML', false, html);
    saveState();
}

init();
lucide.createIcons();
