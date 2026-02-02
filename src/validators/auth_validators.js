import { body } from 'express-validator';
import Estudiante from '../models/Estudiante.js';

export const validarRegistro = [
  // Solo validar campos esenciales y dejar los demás opcionales
  
  // Nombre - obligatorio pero flexible
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es necesario')
    .isLength({ min: 2 }).withMessage('El nombre debe tener al menos 2 caracteres'),
  
  // Apellido - obligatorio pero flexible
  body('apellido')
    .trim()
    .notEmpty().withMessage('El apellido es necesario')
    .isLength({ min: 2 }).withMessage('El apellido debe tener al menos 2 caracteres'),
  
  // Email - obligatorio
  body('email')
    .trim()
    .notEmpty().withMessage('El email es necesario')
    .isEmail().withMessage('Debe ser un email válido')
    .normalizeEmail()
    .custom(async (email) => {
      const emailExiste = await Estudiante.findOne({ email });
      if (emailExiste) {
        throw new Error('Este email ya está registrado');
      }
      return true;
    }),
  
  // Password - obligatorio
  body('password')
    .notEmpty().withMessage('La contraseña es necesaria')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  
  // Carrera - obligatorio pero sin formato específico
  body('carrera')
    .trim()
    .notEmpty().withMessage('La carrera es necesaria'),
  
  // Nivel - obligatorio
  body('nivel')
    .notEmpty().withMessage('El nivel es necesario')
    .isInt({ min: 1, max: 6 }).withMessage('El nivel debe ser un número entre 1 y 6'),
  
  // CÉDULA - HACERLA OPCIONAL
  body('cedula')
    .optional() // Esto hace que sea opcional
    .trim()
    .custom(async (cedula, { req }) => {
      // Solo validar si se envía algo
      if (!cedula || cedula.trim() === '') {
        return true;
      }
      
      // Si se envía, validar formato
      if (!/^\d+$/.test(cedula)) {
        throw new Error('La cédula solo puede contener números');
      }
      
      if (cedula.length !== 10) {
        throw new Error('La cédula debe tener 10 dígitos');
      }
      
      // Verificar si ya existe
      const cedulaExiste = await Estudiante.findOne({ cedula });
      if (cedulaExiste) {
        throw new Error('Esta cédula ya está registrada');
      }
      
      return true;
    }),
  
  // Celular - opcional
  body('celular')
    .optional()
    .trim()
    .custom((celular) => {
      if (!celular || celular.trim() === '') {
        return true;
      }
      if (!/^\d+$/.test(celular)) {
        throw new Error('El celular solo puede contener números');
      }
      if (celular.length !== 10) {
        throw new Error('El celular debe tener 10 dígitos');
      }
      return true;
    }),
  
  // Bio - opcional
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('La biografía no puede exceder 500 caracteres')
];