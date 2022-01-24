
let boundings = [
    [39.9058, -86.091],
    [39.8992, -86.1017],
]

let map = L.map("demo").fitBounds(boundings)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map)

let agentmap = L.A.agentmap(map)

console.log(boundings)

agentmap.buildingify(boundings, mdata)
agentmap.agentify(50, agentmap.seqUnitAgentMaker)
if (agentmap.state.ticks % 300 === 0) {
    agentmap.agents.eachLayer(function (agent) {
        let random_index = Math.floor(
            agentmap.units.count() * Math.random()
        ),
            random_unit = agentmap.units.getLayers()[random_index],
            random_unit_id = agentmap.units.getLayerId(random_unit),
            random_unit_center = random_unit.getBounds().getCenter()

        agent.scheduleTrip(
            random_unit_center,
            { type: "unit", id: random_unit_id },
            1,
            false,
            true
        )
        agent.controller = function () {
            agent.moveIt()
        }
    })
}
agentmap.run()