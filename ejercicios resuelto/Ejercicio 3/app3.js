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
    database: 'alumnos_db'
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

// RUTAS PARA MATERIAS

// GET /materias - Obtener todas las materias
app.get('/materias', async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM materias ORDER BY nombre'
        );
        await connection.end();

        res.json({
            success: true,
            message: 'Materias obtenidas exitosamente',
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

// POST /materias - Crear nueva materia
app.post('/materias', [
    body('nombre')
        .notEmpty()
        .withMessage('El nombre de la materia es requerido')
        .isLength({ min: 3, max: 100 })
        .withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .trim(),
    body('codigo')
        .notEmpty()
        .withMessage('El código de la materia es requerido')
        .isLength({ min: 3, max: 10 })
        .withMessage('El código debe tener entre 3 y 10 caracteres')
        .trim()
        .toUpperCase(),
    body('creditos')
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage('Los créditos deben ser un número entre 1 y 10')
], handleValidationErrors, async (req, res) => {
    try {
        const { nombre, codigo, creditos = 3 } = req.body;
        const connection = await getConnection();

        // Insertar nueva materia
        const [result] = await connection.execute(
            'INSERT INTO materias (nombre, codigo, creditos) VALUES (?, ?, ?)',
            [nombre, codigo, creditos]
        );

        // Obtener la materia creada
        const [newMateria] = await connection.execute(
            'SELECT * FROM materias WHERE id = ?',
            [result.insertId]
        );

        await connection.end();

        res.status(201).json({
            success: true,
            message: 'Materia creada exitosamente',
            data: newMateria[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una materia con ese nombre o código'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// RUTAS PARA ALUMNOS

// GET /alumnos - Obtener todos los alumnos con filtros opcionales
app.get('/alumnos', [
    query('materia_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('El ID de materia debe ser un número entero positivo'),
    query('estado')
        .optional()
        .isIn(['aprobado', 'regular', 'libre'])
        .withMessage('El estado debe ser: aprobado, regular o libre')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();
        let query = `
            SELECT 
                a.id,
                a.nombre AS alumno,
                m.nombre AS materia,
                m.codigo,
                a.nota1,
                a.nota2,
                a.nota3,
                a.promedio,
                CASE 
                    WHEN a.promedio >= 7.0 THEN 'Aprobado'
                    WHEN a.promedio >= 4.0 THEN 'Regular'
                    ELSE 'Libre'
                END AS estado,
                a.fecha_creacion,
                a.fecha_actualizacion
            FROM alumnos a
            JOIN materias m ON a.materia_id = m.id
        `;
        const params = [];
        const conditions = [];

        // Aplicar filtros
        if (req.query.materia_id) {
            conditions.push('a.materia_id = ?');
            params.push(req.query.materia_id);
        }

        if (req.query.estado) {
            const estado = req.query.estado.toLowerCase();
            if (estado === 'aprobado') {
                conditions.push('a.promedio >= 7.0');
            } else if (estado === 'regular') {
                conditions.push('a.promedio >= 4.0 AND a.promedio < 7.0');
            } else if (estado === 'libre') {
                conditions.push('a.promedio < 4.0');
            }
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY a.nombre, m.nombre';

        const [rows] = await connection.execute(query, params);
        await connection.end();

        res.json({
            success: true,
            message: 'Alumnos obtenidos exitosamente',
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

// GET /alumnos/:id - Obtener un alumno específico
app.get('/alumnos/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT 
                a.id,
                a.nombre AS alumno,
                m.id AS materia_id,
                m.nombre AS materia,
                m.codigo,
                a.nota1,
                a.nota2,
                a.nota3,
                a.promedio,
                CASE 
                    WHEN a.promedio >= 7.0 THEN 'Aprobado'
                    WHEN a.promedio >= 4.0 THEN 'Regular'
                    ELSE 'Libre'
                END AS estado,
                a.fecha_creacion,
                a.fecha_actualizacion
            FROM alumnos a
            JOIN materias m ON a.materia_id = m.id
            WHERE a.id = ?
        `, [req.params.id]);
        await connection.end();

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Alumno obtenido exitosamente',
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

// POST /alumnos - Crear nuevo alumno
app.post('/alumnos', [
    body('nombre')
        .notEmpty()
        .withMessage('El nombre del alumno es requerido')
        .isLength({ min: 3, max: 100 })
        .withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .trim(),
    body('materia_id')
        .isInt({ min: 1 })
        .withMessage('El ID de materia debe ser un número entero positivo'),
    body('nota1')
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 1 debe ser un número entre 0 y 10'),
    body('nota2')
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 2 debe ser un número entre 0 y 10'),
    body('nota3')
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 3 debe ser un número entre 0 y 10')
], handleValidationErrors, async (req, res) => {
    try {
        const { nombre, materia_id, nota1, nota2, nota3 } = req.body;
        const connection = await getConnection();

        // Verificar que la materia existe
        const [materia] = await connection.execute(
            'SELECT id FROM materias WHERE id = ?',
            [materia_id]
        );

        if (materia.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'La materia especificada no existe'
            });
        }

        // Insertar nuevo alumno
        const [result] = await connection.execute(
            'INSERT INTO alumnos (nombre, materia_id, nota1, nota2, nota3) VALUES (?, ?, ?, ?, ?)',
            [nombre, materia_id, nota1, nota2, nota3]
        );

        // Obtener el alumno creado con información de materia
        const [newAlumno] = await connection.execute(`
            SELECT 
                a.id,
                a.nombre AS alumno,
                m.nombre AS materia,
                m.codigo,
                a.nota1,
                a.nota2,
                a.nota3,
                a.promedio,
                CASE 
                    WHEN a.promedio >= 7.0 THEN 'Aprobado'
                    WHEN a.promedio >= 4.0 THEN 'Regular'
                    ELSE 'Libre'
                END AS estado
            FROM alumnos a
            JOIN materias m ON a.materia_id = m.id
            WHERE a.id = ?
        `, [result.insertId]);

        await connection.end();

        res.status(201).json({
            success: true,
            message: 'Alumno creado exitosamente',
            data: newAlumno[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un alumno con ese nombre en la materia especificada'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// PUT /alumnos/:id - Actualizar alumno completo
app.put('/alumnos/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo'),
    body('nombre')
        .notEmpty()
        .withMessage('El nombre del alumno es requerido')
        .isLength({ min: 3, max: 100 })
        .withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .trim(),
    body('materia_id')
        .isInt({ min: 1 })
        .withMessage('El ID de materia debe ser un número entero positivo'),
    body('nota1')
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 1 debe ser un número entre 0 y 10'),
    body('nota2')
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 2 debe ser un número entre 0 y 10'),
    body('nota3')
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 3 debe ser un número entre 0 y 10')
], handleValidationErrors, async (req, res) => {
    try {
        const { nombre, materia_id, nota1, nota2, nota3 } = req.body;
        const connection = await getConnection();

        // Verificar que el alumno existe
        const [existing] = await connection.execute(
            'SELECT id FROM alumnos WHERE id = ?',
            [req.params.id]
        );

        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        // Verificar que la materia existe
        const [materia] = await connection.execute(
            'SELECT id FROM materias WHERE id = ?',
            [materia_id]
        );

        if (materia.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'La materia especificada no existe'
            });
        }

        // Actualizar el alumno
        await connection.execute(
            'UPDATE alumnos SET nombre = ?, materia_id = ?, nota1 = ?, nota2 = ?, nota3 = ? WHERE id = ?',
            [nombre, materia_id, nota1, nota2, nota3, req.params.id]
        );

        // Obtener el alumno actualizado
        const [updatedAlumno] = await connection.execute(`
            SELECT 
                a.id,
                a.nombre AS alumno,
                m.nombre AS materia,
                m.codigo,
                a.nota1,
                a.nota2,
                a.nota3,
                a.promedio,
                CASE 
                    WHEN a.promedio >= 7.0 THEN 'Aprobado'
                    WHEN a.promedio >= 4.0 THEN 'Regular'
                    ELSE 'Libre'
                END AS estado
            FROM alumnos a
            JOIN materias m ON a.materia_id = m.id
            WHERE a.id = ?
        `, [req.params.id]);

        await connection.end();

        res.json({
            success: true,
            message: 'Alumno actualizado exitosamente',
            data: updatedAlumno[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un alumno con ese nombre en la materia especificada'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// PATCH /alumnos/:id - Actualizar parcialmente un alumno
app.patch('/alumnos/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo'),
    body('nombre')
        .optional()
        .isLength({ min: 3, max: 100 })
        .withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .trim(),
    body('materia_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('El ID de materia debe ser un número entero positivo'),
    body('nota1')
        .optional()
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 1 debe ser un número entre 0 y 10'),
    body('nota2')
        .optional()
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 2 debe ser un número entre 0 y 10'),
    body('nota3')
        .optional()
        .isFloat({ min: 0, max: 10 })
        .withMessage('La nota 3 debe ser un número entre 0 y 10')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();

        // Verificar que el alumno existe
        const [existing] = await connection.execute(
            'SELECT * FROM alumnos WHERE id = ?',
            [req.params.id]
        );

        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        const updates = [];
        const values = [];

        // Verificar qué campos actualizar
        if (req.body.nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(req.body.nombre);
        }

        if (req.body.materia_id !== undefined) {
            // Verificar que la materia existe
            const [materia] = await connection.execute(
                'SELECT id FROM materias WHERE id = ?',
                [req.body.materia_id]
            );

            if (materia.length === 0) {
                await connection.end();
                return res.status(404).json({
                    success: false,
                    message: 'La materia especificada no existe'
                });
            }

            updates.push('materia_id = ?');
            values.push(req.body.materia_id);
        }

        if (req.body.nota1 !== undefined) {
            updates.push('nota1 = ?');
            values.push(req.body.nota1);
        }

        if (req.body.nota2 !== undefined) {
            updates.push('nota2 = ?');
            values.push(req.body.nota2);
        }

        if (req.body.nota3 !== undefined) {
            updates.push('nota3 = ?');
            values.push(req.body.nota3);
        }

        if (updates.length === 0) {
            await connection.end();
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        values.push(req.params.id);

        // Actualizar el alumno
        await connection.execute(
            `UPDATE alumnos SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // Obtener el alumno actualizado
        const [updatedAlumno] = await connection.execute(`
            SELECT 
                a.id,
                a.nombre AS alumno,
                m.nombre AS materia,
                m.codigo,
                a.nota1,
                a.nota2,
                a.nota3,
                a.promedio,
                CASE 
                    WHEN a.promedio >= 7.0 THEN 'Aprobado'
                    WHEN a.promedio >= 4.0 THEN 'Regular'
                    ELSE 'Libre'
                END AS estado
            FROM alumnos a
            JOIN materias m ON a.materia_id = m.id
            WHERE a.id = ?
        `, [req.params.id]);

        await connection.end();

        res.json({
            success: true,
            message: 'Alumno actualizado exitosamente',
            data: updatedAlumno[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un alumno con ese nombre en la materia especificada'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// DELETE /alumnos/:id - Eliminar alumno
app.delete('/alumnos/:id', [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El ID debe ser un número entero positivo')
], handleValidationErrors, async (req, res) => {
    try {
        const connection = await getConnection();

        // Verificar que el alumno existe y obtener sus datos
        const [existing] = await connection.execute(`
            SELECT 
                a.id,
                a.nombre AS alumno,
                m.nombre AS materia,
                a.promedio
            FROM alumnos a
            JOIN materias m ON a.materia_id = m.id
            WHERE a.id = ?
        `, [req.params.id]);

        if (existing.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        // Eliminar el alumno
        await connection.execute(
            'DELETE FROM alumnos WHERE id = ?',
            [req.params.id]
        );

        await connection.end();

        res.json({
            success: true,
            message: 'Alumno eliminado exitosamente',
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