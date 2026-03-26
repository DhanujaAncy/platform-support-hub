'use strict';
// ═══════════════════════════════════════════════
// Platform Support Hub — Catalyst Backend
// Tables: Products, Developers, Tasks
// File: functions/support_hub_api/index.js
// ═══════════════════════════════════════════════

const express = require('express');
const app = express();
const catalyst = require('zcatalyst-sdk-node');
app.use(express.json());

const q = (cApp, zcql) => cApp.zcql().executeZCQLQuery(zcql);
const tbl = (cApp, name) => cApp.datastore().table(name);

// ── GET /api/dashboard — Load everything in one call ──
app.get('/api/dashboard', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		const [pR, dR, tR] = await Promise.all([
			q(c, "SELECT ROWID, Name, Color, LeadName FROM Products WHERE IsActive = true"),
			q(c, "SELECT ROWID, Name, Role, Status, Skills, Email FROM Developers"),
			q(c, "SELECT ROWID, TaskID, Title, Description, ProductID, TaskPriority, TaskStatus, AssigneeID, Links, CREATEDTIME FROM Tasks ORDER BY CREATEDTIME DESC"),
		]);
		res.json({ status: 'success', data: {
				products: pR.map(r => ({ id: r.Products.ROWID, name: r.Products.Name, color: r.Products.Color, lead: r.Products.LeadName })),
				developers: dR.map(r => ({ id: r.Developers.ROWID, name: r.Developers.Name, avatar: r.Developers.Name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(), role: r.Developers.Role, status: r.Developers.Status, skills: r.Developers.Skills ? r.Developers.Skills.split(',').map(s=>s.trim()) : [] })),
				tasks: tR.map(r => ({ id: r.Tasks.ROWID, taskId: r.Tasks.TaskID, title: r.Tasks.Title, description: r.Tasks.Description, productId: r.Tasks.ProductID, priority: r.Tasks.TaskPriority, status: r.Tasks.TaskStatus, assigneeId: r.Tasks.AssigneeID, links: r.Tasks.Links, createdAt: r.Tasks.CREATEDTIME })),
			}});
	} catch (e) { console.error(e); res.status(500).json({ status:'error', message:'Failed to load dashboard' }); }
});

// ── POST /api/tasks — Create task ──
app.post('/api/tasks', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		const { title, description, productId, priority, status, assigneeId, links } = req.body;
		if (!title || !productId) return res.status(400).json({ status:'error', message:'Title and Product required' });

		let nextNum = 1;
		try {
			const last = await q(c, "SELECT TaskID FROM Tasks ORDER BY CREATEDTIME DESC LIMIT 1");
			if (last.length > 0) {
				const lastId = last[0].Tasks.TaskID;
				const num = parseInt(lastId.replace('TSK-', ''), 10);
				if (!isNaN(num)) nextNum = num + 1;
			}
		} catch { }
		const taskId = `TSK-${String(nextNum).padStart(3,'0')}`;

		const row = { TaskID: taskId, Title: title, Description: description||'', ProductID: productId, TaskPriority: priority||'Medium', TaskStatus: status||'Open', Links: links||'' };
		if (assigneeId) row.AssigneeID = assigneeId;
		await tbl(c, 'Tasks').insertRow(row);

		res.status(201).json({ status:'success', data: { taskId } });
	} catch (e) { console.error(e); res.status(500).json({ status:'error', message:'Failed to create task' }); }
});

// ── PUT /api/tasks/:rowid — Update task ──
app.put('/api/tasks/:rowid', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		const map = { title:'Title', description:'Description', productId:'ProductID', priority:'TaskPriority', status:'TaskStatus', assigneeId:'AssigneeID', links:'Links' };
		const d = { ROWID: req.params.rowid };
		for (const [k,v] of Object.entries(req.body)) { if(map[k]) d[map[k]]=v; }
		await tbl(c, 'Tasks').updateRow(d);
		res.json({ status:'success' });
	} catch (e) { console.error(e); res.status(500).json({ status:'error', message:'Failed to update task' }); }
});

// ── POST /api/products — Add product ──
app.post('/api/products', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		const { name, color, lead } = req.body;
		if (!name) return res.status(400).json({ status:'error', message:'Name required' });
		const row = await tbl(c, 'Products').insertRow({ Name: name, Color: color||'#71717a', LeadName: lead||'', IsActive: true });
		res.status(201).json({ status:'success', data: { id: row.ROWID } });
	} catch (e) { console.error(e); res.status(500).json({ status:'error', message:'Failed to add product' }); }
});

// ── POST /api/developers — Add developer ──
app.post('/api/developers', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		const { name, role, skills, email } = req.body;
		if (!name) return res.status(400).json({ status:'error', message:'Name required' });
		const row = await tbl(c, 'Developers').insertRow({ Name: name, Role: role||'Dev', Status:'active', Skills: Array.isArray(skills)?skills.join(','):(skills||''), Email: email||'' });
		res.status(201).json({ status:'success', data: { id: row.ROWID } });
	} catch (e) { console.error(e); res.status(500).json({ status:'error', message:'Failed to add developer' }); }
});

// ── DELETE /api/tasks/:rowid — Delete a task ──
app.delete('/api/tasks/:rowid', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		await tbl(c, 'Tasks').deleteRow(req.params.rowid);
		res.json({ status: 'success' });
	} catch (e) {
		console.error(e);
		res.status(500).json({ status: 'error', message: 'Failed to delete task' });
	}
});

// ── PUT /api/developers/:rowid — Update developer ──
app.put('/api/developers/:rowid', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		const map = {
			name: 'Name', role: 'Role', status: 'DevStatus',
			skills: 'Skills', email: 'Email'
		};
		const d = { ROWID: req.params.rowid };
		for (const [k, v] of Object.entries(req.body)) {
			if (map[k]) d[map[k]] = Array.isArray(v) ? v.join(',') : v;
		}
		await tbl(c, 'Developers').updateRow(d);
		res.json({ status: 'success' });
	} catch (e) {
		console.error(e);
		res.status(500).json({ status: 'error', message: 'Failed to update developer' });
	}
});

// ── DELETE /api/developers/:rowid — Remove developer ──
app.delete('/api/developers/:rowid', async (req, res) => {
	try {
		const c = catalyst.initialize(req);
		await tbl(c, 'Developers').deleteRow(req.params.rowid);
		res.json({ status: 'success' });
	} catch (e) {
		console.error(e);
		res.status(500).json({ status: 'error', message: 'Failed to delete developer' });
	}
});

module.exports = app;