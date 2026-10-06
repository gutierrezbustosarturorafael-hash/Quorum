const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array({ onlyFirstError: true }).map(error => ({
      field: error.path,
      message: error.msg
    }));
    return res.status(400).json({
      success: false,
      message: `Revisa los siguientes campos: ${details.map(error => `${error.field} (${error.message})`).join(', ')}`,
      errors: details
    });
  }
  next();
};

const text = (field, label, max = 5000) => body(field)
  .optional({ nullable: true })
  .isString().withMessage(`${label} debe ser texto`)
  .trim()
  .isLength({ max }).withMessage(`${label} excede el límite permitido`);

const registerValidation = [
  body('nombre').isString().trim().isLength({ min: 2, max: 160 }).withMessage('El nombre no es válido'),
  body('tipoPersona').isIn(['fisica', 'moral']).withMessage('El tipo de persona no es válido'),
  body('razonSocial').isString().trim().isLength({ min: 2, max: 200 }).withMessage('La razón social no es válida'),
  body('rfc').isString().trim().matches(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i).withMessage('El RFC no tiene un formato válido'),
  body('domicilioFiscal').isString().trim().isLength({ min: 5, max: 500 }).withMessage('El domicilio fiscal no es válido'),
  body('regimenFiscal').isString().trim().isLength({ min: 2, max: 160 }).withMessage('El régimen fiscal no es válido'),
  body('representanteLegal').isString().trim().isLength({ min: 2, max: 160 }).withMessage('El representante legal no es válido'),
  body('telefonoContacto').isString().trim().matches(/^[0-9+() -]{8,20}$/).withMessage('El teléfono no es válido'),
  body('mision').isString().trim().isLength({ min: 2, max: 5000 }).withMessage('La misión no es válida'),
  body('vision').isString().trim().isLength({ min: 2, max: 5000 }).withMessage('La visión no es válida'),
  body('email').isEmail().normalizeEmail().withMessage('El correo no es válido'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('La contraseña debe tener entre 8 y 128 caracteres'),
  body('termsAccepted').custom(value => value === true).withMessage('Debes aceptar los términos y condiciones'),
  body('termsVersion').isString().trim().isLength({ min: 1, max: 40 }).withMessage('La versión de términos no es válida'),
  handleValidation
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('El correo no es válido'),
  body('password').isString().isLength({ min: 1, max: 128 }).withMessage('La contraseña no es válida'),
  handleValidation
];

const reunionValidation = [
  body('titulo').isString().trim().isLength({ min: 2, max: 200 }).withMessage('El título no es válido'),
  body('fecha').isISO8601().withMessage('La fecha no es válida'),
  body('hora').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('La hora no es válida'),
  text('lugar', 'El lugar', 200),
  text('duracion', 'La duración', 80),
  text('objetivo', 'El objetivo', 5000),
  text('coordinador', 'El coordinador', 160),
  body('recurrenciaSemanal').optional().isBoolean().withMessage('La repetición semanal no es válida'),
  body('agenda').optional().isArray({ max: 50 }).withMessage('La agenda no es válida'),
  body('departamentos').optional().isArray({ max: 50 }).withMessage('Los departamentos no son válidos'),
  handleValidation
];

const updateTextValidation = [
  text('minuta', 'La minuta', 30000),
  text('conclusion', 'La conclusión', 5000),
  body('acuerdos').optional().isArray({ max: 100 }).withMessage('Los acuerdos no son válidos'),
  handleValidation
];

module.exports = {
  registerValidation,
  loginValidation,
  reunionValidation,
  updateTextValidation
};
