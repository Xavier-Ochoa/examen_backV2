import { getRandomImage } from "../services/imagenFondo.js";
import { sendMailToRecoveryPassword, sendMailToRegister } from "../helpers/sendMail.js"
import Estudiante from "../models/Estudiante.js"
import { getRandomQuote } from "../services/frases.js";
import { crearTokenJWT } from "../middlewares/JWT.js"
import mongoose from "mongoose"
import { subirImagenCloudinary, eliminarImagenCloudinary } from "../helpers/uploadCloudinary.js"

// ===== FUNCIONES DE SERVICIOS (mantenidas) =====
export const getUnsplashImage = async (req, res) => {
    const { query = "motivational" } = req.query;
    const imageUrl = await getRandomImage(query);
    res.json({ imageUrl });
};

export const fetchQuoteController = async (req, res) => {
  const quote = await getRandomQuote();
  res.json(quote);
};

// ===== AUTENTICACIÓN =====

const registro = async (req, res) => {
    try {
        const { email, password, nombre, apellido } = req.body;
        
        // Validar campos obligatorios
        const camposObligatorios = ['email', 'password', 'nombre', 'apellido'];
        const camposFaltantes = camposObligatorios.filter(campo => !req.body[campo]);
        
        if (camposFaltantes.length > 0) {
            return res.status(400).json({
                msg: `Faltan campos obligatorios: ${camposFaltantes.join(', ')}`
            });
        }
        
        const verificarEmailBDD = await Estudiante.findOne({email});
        if(verificarEmailBDD) {
            return res.status(400).json({msg: "Lo sentimos, el email ya se encuentra registrado"});
        }
        
        const nuevoEstudiante = new Estudiante(req.body);
        nuevoEstudiante.password = await nuevoEstudiante.encryptPassword(password);
        nuevoEstudiante.token = nuevoEstudiante.createToken();
       
        // Manejar subida de foto de perfil
        if (req.files?.fotoPerfil) {
            console.log("📸 Procesando foto de perfil...");
            
            const fotoPerfil = req.files.fotoPerfil;
            
            // Validar que sea una imagen
            const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
            if (!tiposPermitidos.includes(fotoPerfil.mimetype)) {
                return res.status(400).json({
                    msg: "Formato de imagen no válido. Use JPEG, PNG o GIF"
                });
            }
            
            // Validar tamaño (máximo 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (fotoPerfil.size > maxSize) {
                return res.status(400).json({
                    msg: "La imagen es demasiado grande. Máximo 5MB"
                });
            }
            
            // Verificar que exista la ruta temporal
            if (!fotoPerfil.tempFilePath) {
                console.warn("⚠️ No hay ruta temporal para la imagen");
                // Asignar foto por defecto
                nuevoEstudiante.fotoPerfil = {
                    url: "https://res.cloudinary.com/dbiiapon8/image/upload/v1769933902/sinimages_vcyuf7.png",
                    publicId: "default-profile"
                };
            } else {
                try {
                    console.log("🌐 Subiendo a Cloudinary desde:", fotoPerfil.tempFilePath);
                    
                    const resultadoCloudinary = await subirImagenCloudinary(
                        fotoPerfil.tempFilePath,
                        'Perfiles'
                    );
                    
                    if (!resultadoCloudinary.secure_url || !resultadoCloudinary.public_id) {
                        throw new Error("Respuesta inválida de Cloudinary");
                    }
                    
                    nuevoEstudiante.fotoPerfil = {
                        url: resultadoCloudinary.secure_url,
                        publicId: resultadoCloudinary.public_id
                    };
                    
                    console.log("✅ Foto guardada en Cloudinary:", {
                        url: nuevoEstudiante.fotoPerfil.url,
                        publicId: nuevoEstudiante.fotoPerfil.publicId
                    });
                    
                } catch (cloudinaryError) {
                    console.error("❌ Error Cloudinary:", cloudinaryError);
                    // En caso de error en Cloudinary, usar foto por defecto
                    nuevoEstudiante.fotoPerfil = {
                        url: "https://res.cloudinary.com/demo/image/upload/v1712345678/default-profile.png",
                        publicId: "default-profile"
                    };
                }
            }
        } else {
            // Foto por defecto si no se envía ninguna
            nuevoEstudiante.fotoPerfil = {
                url: "https://res.cloudinary.com/demo/image/upload/v1712345678/default-profile.png",
                publicId: "default-profile"
            };
        }
        
        // Guardar primero el estudiante en la base de datos
        await nuevoEstudiante.save();
        console.log("✅ Estudiante guardado en MongoDB:", nuevoEstudiante._id);
        
        // Enviar correo de confirmación después de guardar
        try {
            console.log("📧 Enviando correo de confirmación a:", email);
            const emailResult = await sendMailToRegister(email, nuevoEstudiante.token);
            
            if (emailResult && emailResult.success) {
                console.log("✅ Correo enviado exitosamente");
            } else {
                console.warn("⚠️ Problema al enviar correo, pero usuario registrado");
            }
        } catch (emailError) {
            console.error("❌ Error al enviar correo:", emailError);
            // El usuario ya está registrado, así que no revertimos
        }
        
        res.status(201).json({
            success: true,
            msg: "Registro exitoso. Revisa tu correo para confirmar tu cuenta.",
            data: {
                _id: nuevoEstudiante._id,
                nombre: nuevoEstudiante.nombre,
                email: nuevoEstudiante.email,
                fotoPerfil: nuevoEstudiante.fotoPerfil.url
            }
        });

    } catch (error) {
        console.error("❌ Error completo en registro:", {
            message: error.message,
            stack: error.stack,
            body: req.body,
            files: req.files ? Object.keys(req.files) : 'No files'
        });
        
        // Si es error de validación de Mongoose
        if (error.name === 'ValidationError') {
            const errores = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                msg: "Error de validación",
                errors: errores
            });
        }
        
        res.status(500).json({ 
            msg: `Error en el servidor: ${error.message}`,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
}

const confirmarMail = async (req, res) => {
    try {
        const { token } = req.params
        const estudianteBDD = await Estudiante.findOne({ token })
        if (!estudianteBDD) return res.status(404).json({ msg: "Token inválido o cuenta ya confirmada" })
        estudianteBDD.token = null
        estudianteBDD.confirmEmail = true
        await estudianteBDD.save()
        res.status(200).json({ msg: "Cuenta confirmada, ya puedes iniciar sesión" })

    } catch (error) {
    console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const recuperarPassword = async (req, res) => {
     try {
        const { email } = req.body
        if (!email) return res.status(400).json({ msg: "Debes ingresar un correo electrónico" })
        const estudianteBDD = await Estudiante.findOne({ email })
        if (!estudianteBDD) return res.status(404).json({ msg: "El usuario no se encuentra registrado" })
        const token = estudianteBDD.createToken()
        estudianteBDD.token = token
        await sendMailToRecoveryPassword(email, token)
        await estudianteBDD.save()
        res.status(200).json({ msg: "Revisa tu correo electrónico para reestablecer tu cuenta" })
        
    } catch (error) {
    console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }    
}

const comprobarTokenPasword = async (req,res)=>{
    try {
        const {token} = req.params
        const estudianteBDD = await Estudiante.findOne({token})
        if(estudianteBDD?.token !== token) return res.status(404).json({msg:"Lo sentimos, no se puede validar la cuenta"})
        res.status(200).json({msg:"Token confirmado, ya puedes crear tu nuevo password"}) 
    
    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const crearNuevoPassword = async (req,res)=>{
    try {
        const{password,confirmpassword} = req.body
        const { token } = req.params
        
        if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Debes llenar todos los campos"})
        if(password !== confirmpassword) return res.status(404).json({msg:"Los passwords no coinciden"})
        const estudianteBDD = await Estudiante.findOne({token})
        if(!estudianteBDD) return res.status(404).json({msg:"No se puede validar la cuenta"})
            
        
        estudianteBDD.password = await estudianteBDD.encryptPassword(password)
        estudianteBDD.token = null
        await estudianteBDD.save()
        
        res.status(200).json({msg:"Felicitaciones, ya puedes iniciar sesión con tu nuevo password"}) 

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body

        //  Verifica que todos los campos estén llenos
        if (Object.values(req.body).includes("")) 
            return res.status(404).json({ msg: "Debes llenar todos los campos" })

        //  Busca al estudiante por email
        const estudianteBDD = await Estudiante.findOne({ email })
            .select("-status -__v -token -updatedAt -createdAt")
        if (!estudianteBDD) 
            return res.status(404).json({ msg: "El usuario no se encuentra registrado" })

        //  Verifica que haya confirmado su email
        if (!estudianteBDD.confirmEmail) 
            return res.status(403).json({ msg: "Debes verificar tu cuenta antes de iniciar sesión" })

        //  Verifica la contraseña
        const verificarPassword = await estudianteBDD.matchPassword(password)
        if (!verificarPassword) 
            return res.status(401).json({ msg:"Lo sentimos, el password no es el correcto" })

        //  Extrae los datos necesarios
        const { nombre, apellido, celular, _id, rol, carrera, nivel, cedula, fotoPerfil } = estudianteBDD

        //  Crea el token JWT
        const token = crearTokenJWT(_id, rol)

        //  Devuelve token + datos del usuario
        res.status(200).json({
            token,
            rol,
            nombre,
            apellido,
            celular,
            carrera,
            nivel,
            cedula,
            _id,
            email: estudianteBDD.email,
            fotoPerfil
        })

    } catch (error) {
        console.error(error)
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

const perfil = (req, res) => {
  try {
    // Paso 1: ya se realiza en el middleware

    // Paso 2 y 3
    const { token, confirmEmail, createdAt, updatedAt, __v, ...datosPerfil } =
      req.estudianteHeader;

    // Paso 4
    res.status(200).json(datosPerfil);

  } catch (error) {
    res.status(500).json({
      msg: `Error en el servidor: ${error}`
    });
  }
};

const actualizarPerfil = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, celular, email, carrera, nivel, cedula, bio } = req.body;

    // Verificar si el ID es válido
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ msg: `ID inválido: ${id}` });

    const estudianteBDD = await Estudiante.findById(id);
    if (!estudianteBDD) return res.status(404).json({ msg: `No existe el estudiante con ID ${id}` });

    // Si el email cambia, verificar que el nuevo email no esté en uso
    if (email && estudianteBDD.email !== email) {
      const emailExistente = await Estudiante.findOne({ email });
      if (emailExistente) {
        return res.status(404).json({ msg: `El email ya se encuentra registrado` });
      }
    }

    // Si se está enviando una nueva foto de perfil, manejarla
    if (req.files?.fotoPerfil) {
      // Eliminar foto anterior de Cloudinary si existe
      if (estudianteBDD.fotoPerfil?.publicId) {
        try {
          await eliminarImagenCloudinary(estudianteBDD.fotoPerfil.publicId);
        } catch (error) {
          console.error('Error al eliminar foto anterior de Cloudinary:', error);
        }
      }

      // Subir nueva foto de perfil a Cloudinary
      const { secure_url, public_id } = await subirImagenCloudinary(
        req.files.fotoPerfil.tempFilePath,
        'Perfiles'
      );

      estudianteBDD.fotoPerfil = {
        url: secure_url,
        publicId: public_id
      };
    }

    // Actualizar solo los campos que se están enviando en req.body
    estudianteBDD.nombre = nombre ?? estudianteBDD.nombre;
    estudianteBDD.apellido = apellido ?? estudianteBDD.apellido;
    estudianteBDD.celular = celular ?? estudianteBDD.celular;
    estudianteBDD.email = email ?? estudianteBDD.email;
    estudianteBDD.carrera = carrera ?? estudianteBDD.carrera;
    estudianteBDD.nivel = nivel ?? estudianteBDD.nivel;
    estudianteBDD.cedula = cedula ?? estudianteBDD.cedula;
    estudianteBDD.bio = bio ?? estudianteBDD.bio;

    // Guardar los cambios en la base de datos
    await estudianteBDD.save();

    res.status(200).json(estudianteBDD);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: `❌ Error en el servidor - ${error.message}` });
  }
};


const actualizarPassword = async (req,res)=>{
    try {
        const estudianteBDD = await Estudiante.findById(req.estudianteHeader._id)
        if(!estudianteBDD) return res.status(404).json({msg:`Lo sentimos, no existe el estudiante`})
        const verificarPassword = await estudianteBDD.matchPassword(req.body.passwordactual)
        if(!verificarPassword) return res.status(404).json({msg:"Lo sentimos, el password actual no es el correcto"})
        estudianteBDD.password = await estudianteBDD.encryptPassword(req.body.passwordnuevo)
        await estudianteBDD.save()

    res.status(200).json({msg:"Password actualizado correctamente"})
    } catch (error) {
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` })
    }
}

export {
    registro,
    confirmarMail,
    recuperarPassword,
    comprobarTokenPasword,
    crearNuevoPassword,
    login,
    perfil,
    actualizarPerfil,
    actualizarPassword
}