import { Router } from 'express';
import {
  listarProyectos,
  obtenerProyecto,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  listarProyectosPorCategoria,
  listarProyectosPorEstudiante,
  buscarProyectos,
  agregarLike,
  quitarLike,
  agregarComentario,
  eliminarComentario,
  proyectosDestacados,
  listarProyectosPorCarrera,
} from '../controllers/proyecto_controller.js';
import { verificarTokenJWT } from '../middlewares/JWT.js';

// ⭐ IMPORTAR VALIDACIONES
import { 
  validarCrearProyecto, 
  validarActualizarProyecto,
  validarAgregarComentario 
} from '../validators/proyecto_validators.js';
import { manejarErroresValidacion } from '../middlewares/validaciones.js';

const router = Router();

// ===== RUTAS PÚBLICAS =====
router.get('/', listarProyectos);
router.get('/destacados', proyectosDestacados);
router.get('/buscar', buscarProyectos);
router.get('/categoria/:tipo', listarProyectosPorCategoria);
router.get('/carrera/:carrera', listarProyectosPorCarrera);
router.get('/estudiante/:id', listarProyectosPorEstudiante);
router.get('/:id', obtenerProyecto);

// ===== RUTAS PROTEGIDAS CON VALIDACIONES =====

// Crear proyecto (CON VALIDACIÓN)
router.post(
  '/', 
  verificarTokenJWT,           // 1. Verificar autenticación
  validarCrearProyecto,        // 2. Validar datos
  manejarErroresValidacion,    // 3. Manejar errores
  crearProyecto                // 4. Ejecutar controlador
);

// Actualizar proyecto (CON VALIDACIÓN)
router.put(
  '/:id', 
  verificarTokenJWT,
  validarActualizarProyecto,
  manejarErroresValidacion,
  actualizarProyecto
);

// Eliminar proyecto
router.delete('/:id', verificarTokenJWT, eliminarProyecto);

// Agregar like
router.post('/:id/like', verificarTokenJWT, agregarLike);

// Quitar like
router.delete('/:id/like', verificarTokenJWT, quitarLike);

// Agregar comentario (CON VALIDACIÓN)
router.post(
  '/:id/comentarios', 
  verificarTokenJWT,
  validarAgregarComentario,
  manejarErroresValidacion,
  agregarComentario
);

// Eliminar comentario
router.delete('/:id/comentarios/:comentarioId', verificarTokenJWT, eliminarComentario);

export default router;