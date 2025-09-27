import express from 'express';
import mysql from 'mysql2';
import { body, validationResult } from 'express-validator';
import cors from 'cors';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

//conexion a la base de datos
const connection = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '43611679',
    database: 'rectangulo',
});

//Conectar a la base de datos
connection.connect((err) => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        return;
    }
    console.log('Conectado a MySQL');
});

// Validaciones
const validateRectangulo = [
    body('lado1').isFloat({ min: 0.01 }).withMessage('Lado 1 debe ser un número positivo'),
    body('lado2').isFloat({ min: 0.01 }).withMessage('Lado 2 debe ser un número positivo')
];

// Funciones de cálculo
const calcularPerimetro = (lado1, lado2) => 2 * (lado1 + lado2);
const calcularSuperficie = (lado1, lado2) => lado1 * lado2;

// Rutas

// GET Obtener todos los rectángulos
app.get('/rectangulos', (req, res) => {
    const query = 'SELECT * FROM rectangulos ORDER BY id DESC'; 
    
    connection.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        res.json(results);
    });
});

// GET Obtener un rectángulo específico
app.get('/rectangulos/:id', (req, res) => {
    const id = req.params.id;
    const query = 'SELECT * FROM rectangulos WHERE id = ?';
    
    connection.query(query, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'error en la base de datos' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'rectángulo no encontrado' });
        }
        res.json(results[0]);
    });
});

// POST Crear un nuevo rectángulo
app.post('/rectangulos', validateRectangulo, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { lado1, lado2 } = req.body;
    const perimetro = calcularPerimetro(lado1, lado2);
    const superficie = calcularSuperficie(lado1, lado2);

    const query = 'INSERT INTO rectangulos (lado1, lado2, perimetro, superficie) VALUES (?, ?, ?, ?)';
    
    connection.query(query, [lado1, lado2, perimetro, superficie], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'error al crear rectángulo' });
        }
        
        res.status(201).json({
            id: results.insertId,
            lado1,
            lado2,
            perimetro,
            superficie,
            message: 'Rectángulo creado exitosamente'
        });
    });
});

// PUT /rectangulos/:id - Modificar un rectángulo
app.put('/rectangulos/:id', validateRectangulo, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.id;
    const { lado1, lado2 } = req.body;
    const perimetro = calcularPerimetro(lado1, lado2);
    const superficie = calcularSuperficie(lado1, lado2);

    const query = 'UPDATE rectangulos SET lado1 = ?, lado2 = ?, perimetro = ?, superficie = ? WHERE id = ?';
    
    connection.query(query, [lado1, lado2, perimetro, superficie, id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'error al actualizar rectángulo' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Rectángulo no encontrado' });
        }
        
        res.json({
            id: parseInt(id),
            lado1,
            lado2,
            perimetro,
            superficie,
            message: 'Rectángulo actualizado exitosamente'
        });
    });
});

// DELETE 
app.delete('/rectangulos/:id', (req, res) => {
    const id = req.params.id;
    const query = 'DELETE FROM rectangulos WHERE id = ?';
    
    connection.query(query, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error al eliminar rectángulo' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'rectángulo no encontrado' });
        }
        
        res.json({ message: 'Rectángulo eliminado exitosamente' });
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`servidor activo en http://localhost:${PORT}`);
});
