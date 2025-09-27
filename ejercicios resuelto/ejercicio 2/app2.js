// app.js
const express = require('express');
const mysql = require('mysql2/promise');
const { body, query, param, validationResult } = require('express-validator');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'tu_password', // Cambiar por tu password
    database: 'tareas_db'
};

// Función para crear conexión a la BD
async function getConnection() {
    return await mysql.createConnection(dbConfig);
}

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Errores de validación',
            errors: errors.array()
        });
    }
    next();
};

// RUTAS

// GET /tareas - Obtener todas las tareas con filtro opcional
app.get('/tareas', [
    query('completada')
        .optional()
        .isBoolean()
        .withMessage('El parámetro completada debe ser true o false')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();
        let query = 'SELECT * FROM tareas';
        let params = [];

        // Aplicar filtro si existe
        if (req.query.completada !== undefined) {
            query += ' WHERE completada = ?';
            params.push(req.query.completada === 'true');
        }

        query += ' ORDER BY fecha_creacion DESC';

        const [rows] = await connection.execute(query, params);
        await connection.end();

        res.json({
            success: true,
            message: 'Tareas obtenidas exitosamente',
            data: rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// GET /tareas/:id - Obtener una tarea específica
app.get('/tareas/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM tareas WHERE id = ?',
            [req.params.id]
        );
        await connection.end();

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Tarea obtenida exitosamente',
            data: rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// POST /tareas - Crear nueva tarea
app.post('/tareas', [
    body('nombre')
        .notEmpty()
        .withMessage('El nombre de la tarea es requerido')
        .isLength({ min: 3, max: 255 })
        .withMessage('El nombre debe tener entre 3 y 255 caracteres')
        .trim(),
    body('completada')
        .optional()
        .isBoolean()
        .withMessage('El campo completada debe ser true o false')
], handleValidationErrors, async (req, res) => {
    try {
        const { nombre, completada = false } = req.body;
        const connection = await getConnection();

        // Verificar si ya existe una tarea con el mismo nombre
        const [existing] = await connection.execute(
            'SELECT id FROM tareas WHERE nombre = ?',
            [nombre]
        );

        if (existing.length > 0) {
            await connection.end();
            return res.status(409).json({
                success: false,
                message: 'Ya existe una tarea con ese nombre'
            });
        }

        // Crear la nueva tarea
        const [result] = await connection.execute(
            'INSERT INTO tareas (nombre, completada) VALUES (?, ?)',
            [nombre, completada]
        );

        // Obtener la tarea creada
        const [newTask] = await connection.execute(
            'SELECT * FROM tareas WHERE id = ?',
            [result.insertId]
        );

        await connection.end();

        res.status(201).json({
            success: true,
            message: 'Tarea creada exitosamente',
            data: newTask[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// PUT /tareas/:id - Actualizar tarea completa
app.put('/tareas/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo'),
    body('nombre')
        .notEmpty()
        .withMessage('El nombre de la tarea es requerido')
        .isLength({ min: 3, max: 255 })
        .withMessage('El nombre debe tener entre 3 y 255 caracteres')
        .trim(),
    body('completada')
        .isBoolean()
        .withMessage('El campo completada debe ser true o false')
], handleValidationErrors, async (req, res) => {
    try {
        const { nombre, completada } = req.body;
        const connection = await getConnection();

        // Verificar si la tarea existe
        const [existing] = await connection.execute(
            'SELECT id FROM tareas WHERE id = ?',
            [req.params.id]
        );

        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Verificar si ya existe otra tarea con el mismo nombre
        const [duplicate] = await connection.execute(
            'SELECT id FROM tareas WHERE nombre = ? AND id != ?',
            [nombre, req.params.id]
        );

        if (duplicate.length > 0) {
            await connection.end();
            return res.status(409).json({
                success: false,
                message: 'Ya existe otra tarea con ese nombre'
            });
        }

        // Actualizar la tarea
        await connection.execute(
            'UPDATE tareas SET nombre = ?, completada = ? WHERE id = ?',
            [nombre, completada, req.params.id]
        );

        // Obtener la tarea actualizada
        const [updatedTask] = await connection.execute(
            'SELECT * FROM tareas WHERE id = ?',
            [req.params.id]
        );

        await connection.end();

        res.json({
            success: true,
            message: 'Tarea actualizada exitosamente',
            data: updatedTask[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// PATCH /tareas/:id - Actualizar parcialmente una tarea
app.patch('/tareas/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo'),
    body('nombre')
        .optional()
        .isLength({ min: 3, max: 255 })
        .withMessage('El nombre debe tener entre 3 y 255 caracteres')
        .trim(),
    body('completada')
        .optional()
        .isBoolean()
        .withMessage('El campo completada debe ser true o false')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();

        // Verificar si la tarea existe
        const [existing] = await connection.execute(
            'SELECT * FROM tareas WHERE id = ?',
            [req.params.id]
        );

        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        const updates = [];
        const values = [];

        if (req.body.nombre !== undefined) {
            // Verificar si ya existe otra tarea con el mismo nombre
            const [duplicate] = await connection.execute(
                'SELECT id FROM tareas WHERE nombre = ? AND id != ?',
                [req.body.nombre, req.params.id]
            );

            if (duplicate.length > 0) {
                await connection.end();
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe otra tarea con ese nombre'
                });
            }

            updates.push('nombre = ?');
            values.push(req.body.nombre);
        }

        if (req.body.completada !== undefined) {
            updates.push('completada = ?');
            values.push(req.body.completada);
        }

        if (updates.length === 0) {
            await connection.end();
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        values.push(req.params.id);

        // Actualizar la tarea
        await connection.execute(
            `UPDATE tareas SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // Obtener la tarea actualizada
        const [updatedTask] = await connection.execute(
            'SELECT * FROM tareas WHERE id = ?',
            [req.params.id]
        );

        await connection.end();

        res.json({
            success: true,
            message: 'Tarea actualizada exitosamente',
            data: updatedTask[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// DELETE /tareas/:id - Eliminar tarea
app.delete('/tareas/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();

        // Verificar si la tarea existe
        const [existing] = await connection.execute(
            'SELECT * FROM tareas WHERE id = ?',
            [req.params.id]
        );

        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Eliminar la tarea
        await connection.execute(
            'DELETE FROM tareas WHERE id = ?',
            [req.params.id]
        );

        await connection.end();

        res.json({
            success: true,
            message: 'Tarea eliminada exitosamente',
            data: existing[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;