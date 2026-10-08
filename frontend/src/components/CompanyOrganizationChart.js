import React from 'react';
import { Badge, Card } from 'react-bootstrap';
import { BriefcaseBusiness, Building2, UserRound, Users } from 'lucide-react';

const normalize = value => String(value || '').trim().toLocaleLowerCase('es');

const buildDepartmentFallback = (departments, directors, employees, subareasByDepartment) => {
  const uniqueDepartments = [...new Map(
    (departments || [])
      .map(department => String(department || '').trim())
      .filter(Boolean)
      .map(department => [normalize(department), department])
  ).values()].sort((left, right) => left.localeCompare(right, 'es'));

  return uniqueDepartments.map(name => {
    const departmentKey = normalize(name);
    const areaDirectors = (directors || []).filter(director =>
      [director.area, ...(director.areasACargo || [])].some(area => normalize(area) === departmentKey)
    );
    const areaEmployees = (employees || []).filter(employee =>
      employee.rol !== 'directivo'
        && employee.asignacionConfirmada !== false
        && normalize(employee.area) === departmentKey
    );
    const registeredSubareas = Object.entries(subareasByDepartment || {})
      .find(([department]) => normalize(department) === departmentKey)?.[1] || [];
    const subareaNames = [...new Set([
      ...areaDirectors.flatMap(director => director.subareas || []),
      ...registeredSubareas,
      ...areaEmployees.map(employee => employee.subarea)
    ].map(subarea => String(subarea || '').trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'es'));

    return {
      nombre: name,
      directivos: areaDirectors.map(director => ({
        nombre: director.nombre || 'Directivo',
        cargo: director.cargo || 'Dirección de área'
      })),
      empleados: areaEmployees
        .filter(employee => !employee.subarea)
        .map(employee => ({ nombre: employee.nombre || 'Empleado', rol: employee.rol || 'trabajador' })),
      subareas: subareaNames.map(subarea => ({
        nombre: subarea,
        empleados: areaEmployees
          .filter(employee => normalize(employee.subarea) === normalize(subarea))
          .map(employee => ({ nombre: employee.nombre || 'Empleado', rol: employee.rol || 'trabajador' }))
      }))
    };
  });
};

const Person = ({ person }) => (
  <div className="company-org-person">
    <UserRound size={30} strokeWidth={1.7} aria-hidden="true" />
    <div className="company-org-person-info">
      <strong>{person.nombre}</strong>
      {person.cargo && <span>{person.cargo}</span>}
    </div>
  </div>
);

const CompanyOrganizationChart = ({
  areas = [],
  companyName = '',
  legalRepresentative = '',
  departments = [],
  directors = [],
  employees = [],
  subareasByDepartment = {}
}) => {
  const organization = areas.length
    ? areas
    : buildDepartmentFallback(departments, directors, employees, subareasByDepartment);

  return (
    <Card className="company-org-chart mb-4">
      <Card.Body>
        <div className="employee-section-heading mb-3">
          <div className="employee-section-icon"><BriefcaseBusiness size={19} /></div>
          <div>
            <span className="employee-profile-caption">ESTRUCTURA ORGANIZACIONAL</span>
            <h2>Organigrama de la empresa</h2>
            <p className="mb-0">Departamentos, responsables, áreas derivadas y sus equipos.</p>
          </div>
        </div>
        <div className={`company-org-tree${organization.length ? ' has-departments' : ''}`}>
          <div className="company-org-root">
            {companyName && (
              <div className="company-org-company">
                <Building2 size={22} aria-hidden="true" />
                <div>
                  <span>EMPRESA</span>
                  <h3>{companyName}</h3>
                </div>
              </div>
            )}
            {legalRepresentative && (
              <div className="company-org-legal-representative">
                <Person person={{ nombre: legalRepresentative, cargo: 'Representante legal' }} />
              </div>
            )}
          </div>
          {organization.length ? (
            <div className="company-org-branches">
              {organization.map(area => (
              <section key={area.nombre} className="company-org-branch">
                <div className="company-org-department">
                  <h3>{area.nombre}</h3>
                  <Badge bg="secondary">
                    <Users size={13} className="me-1" />
                    {(area.directivos || []).length + (area.empleados || []).length
                      + (area.subareas || []).reduce((total, subarea) => total + (subarea.empleados || []).length, 0)}
                  </Badge>
                </div>
                <div className="company-org-branch-content">
                  {(area.directivos || []).map((person, index) => (
                    <div className="company-org-position" key={`director-${person.nombre}-${index}`}>
                      <Person person={person} />
                    </div>
                  ))}
                  {(area.subareas || []).map(subarea => (
                    <section className="company-org-derived-node" key={subarea.nombre}>
                      <h4>{subarea.nombre}</h4>
                      {subarea.empleados?.length
                        ? <div className="company-org-people">{subarea.empleados.map((person, index) => (
                          <Person key={`${person.nombre}-${index}`} person={person} />
                        ))}</div>
                        : <p className="small text-muted mb-0">Sin integrantes asignados</p>}
                    </section>
                  ))}
                  {(area.empleados || []).length > 0 && (
                    <section className="company-org-team-node">
                      <h4>Equipo del departamento</h4>
                      <div className="company-org-people">{area.empleados.map((person, index) => (
                        <Person key={`${person.nombre}-${index}`} person={person} />
                      ))}</div>
                    </section>
                  )}
                  {!(area.directivos || []).length
                    && !(area.empleados || []).length
                    && !(area.subareas || []).length
                    && <p className="small text-muted mb-0">Aún no hay integrantes asignados.</p>}
                </div>
              </section>
              ))}
            </div>
          ) : (
            <p className="text-muted mb-0">El organizador todavía no registra áreas principales para mostrar.</p>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default CompanyOrganizationChart;
